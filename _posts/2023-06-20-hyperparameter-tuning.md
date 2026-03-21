---
layout: distill
title: Fast and Scalable Hyperparameter Tuning and Cross-validation in AWS SageMaker
description: Using SageMaker Managed Warm Pools.
date: 2023-03-03
featured: true
tags: hyperparameter-tuning sagemaker aws
giscus_comments: true
thumbnail: assets/img/cover_photo_finetuning_article.jpg
tikzjax: true

authors:
  - name: João Pereira

bibliography:

# Optionally, you can add a table of contents to your post.
# NOTES:
#   - make sure that TOC names match the actual section names
#     for hyperlinks within the post to work correctly.
#   - we may want to automate TOC generation in the future using
#     jekyll-toc plugin (https://github.com/toshimaru/jekyll-toc).
toc:
  - name: What are Warm Pools?
  - name: End-to-end SageMaker Pipeline
  - name: What happens inside the Tuning step?
  - name: What do we get out of using Warm Pools?
  - name: Summary
# Below is an example of injecting additional post-specific styles.
# If you use this post as a template, delete this _styles block.
_styles: >
  .fake-img {
    background: #bbb;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 0px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 12px;
  }
  .fake-img p {
    font-family: monospace;
    color: white;
    text-align: left;
    margin: 12px 0;
    text-align: center;
    font-size: 16px;
  }
---

This article shares a recipe to **speeding up to 60%** your **hyperparameter tuning with cross-validation in SageMaker Pipelines leveraging SageMaker Managed Warm Pools. By using Warm Pools, the runtime of a Tuning step with 120 sequential jobs is reduced** from 10h to 4h.

Improving and evaluating the performance of a machine learning model often requires a variety of ingredients. Hyperparameter tuning and cross-validation are 2 such ingredients. The first finds the best version of a model, while the second estimates how a model will generalize to unseen data. These steps, combined, introduce computing challenges as they require training and validating a model multiple times, in parallel and/or in sequence.

**What this article is about...**

- What are Warm Pools and how to leverage them to speed-up hyperparameter tuning with cross-validation.
- How to design a production-grade SageMaker Pipeline that includes Processing, Tuning, Training, and Lambda steps.

We will consider [Bayesian optimization](https://towardsdatascience.com/bayesian-optimization-for-hyperparameter-tuning-how-and-why-655b0ee0b399) for hyperparameter tuning that leverages the scores of the hyperparameter combinations already tested to choose the hyperparameter set to test in the next round. We will use $ k $-fold cross-validation to score each combination of hyperparameters, in which the splits are as follows:

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/folds.png" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    $ k $-fold cross-validation strategy.
</div>

The full dataset is partitioned into 𝑘 validation folds, the model trained on $ k-1 $ folds, and validated on its corresponding held-out fold. The overall score is the average over the individual validation scores obtained for each validation fold.

---

## What are Warm Pools?

Whenever a training job is launched in AWS, the provisioned instance takes roughly 3min to bootstrap before the training script is executed. This startup time adds up when running multiple jobs sequentially, which is the case when performing hyperparameter tuning using a Bayesian optimization strategy. Here, dozens or even hundreds of jobs are run in sequence leading to a significant total time that can be on par with or even higher than the actual execution times of the scripts.

[SageMaker Managed Warm Pools](https://aws.amazon.com/about-aws/whats-new/2022/09/reduce-ml-model-training-job-startup-time-8x-sagemaker-training-managed-warm-pools/) make it possible to retain training infrastructure after a job is completed for a desired number of seconds, enabling saving the instance startup time for every subsequent job.

Enabling Warm Pools is straightforward. You simply add an extra parameter (`keep_alive_period_in_seconds`) when creating a training job in SageMaker:

{% highlight python %}
estimator = Estimator(
entry_point='training.py',
keep_alive_period_in_seconds=600,
...
)
{% endhighlight %}

If you want to learn more about SageMaker Managed Warm Pools, here is the documentation:

> [Train Using SageMaker Managed Warm Pools](https://docs.aws.amazon.com/sagemaker/latest/dg/train-warm-pools.html)

Now that we know what are Warm Pools, in Section [End-to-End SageMaker Pipeline](#end-to-end-sagemaker-pipeline) we are going to dive deep into how to leverage them to speed-up the overall runtime of a SageMaker Pipeline that includes hyperparameter tuning with cross-validation.

## End-to-end SageMaker Pipeline

The following figure depicts an end-to-end SageMaker Pipeline that performs hyperparameter tuning with cross-validation.

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/pipeline.png" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
  Architecture diagram of the end-to-end SageMaker Pipeline.
</div>

We will create the pipeline using the [SageMaker Python SDK](https://sagemaker.readthedocs.io/en/stable), which is an open-source library that simplifies the process of training, tuning, and deploying machine learning models in AWS SageMaker. The pipeline steps in the diagram are summarized as follows:

1. **Data Preprocessing** (`ProcessingStep`) --- Data is retrieved from the source, transformed, and split into k cross-validation folds. An additional full dataset is saved for final training.
2. **Hyperparameter Tuning With CV** (`TuningStep`) --- This is the step that we will concentrate on. It finds the combination of hyperparameters that achieves the best average performance across validation folds.
3. **Optimal Hyperparameters Retrieval** (`LambdaStep`) --- Fires a Lambda function that retrieves the optimal set of hyperparameters by accessing the results of the hyperparameter tuning job using Boto3.
4. **Final Training** (`TrainingStep`) --- Trains the model on the full dataset `train_full.csv` with the optimal hyperparameters.
5. **Model Registration** (`ModelStep`) –-- Registers the final trained model in the SageMaker Model Registry.
6. **Inference** (`TransformStep`) --– Generates predictions using the registered model.

Please find detailed documentation on how to implement these steps on the [SageMaker Developer Guide](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-steps.html).

## What happens inside the Tuning step?

Let’s now dig deeper into the **pipeline step 2** that iteratively tries and cross-validates multiple hyperparameter combinations in parallel and in sequence. The solution is represented in the following diagram:

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/hpo.png" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
  Architecture diagram of the hyperparameter tuning with cross-validation step.
</div>

The solution relies on SageMaker Automatic Model Tuning to create and orchestrate the training jobs that test multiple hyperparameter combinations. The Automatic Model Tuning job can be launched using the HyperparameterTuner available in the [SageMaker Python SDK](https://sagemaker.readthedocs.io/en/stable/). It creates $ M \times N $ hyperparameter tuning training jobs, $ M $ of which are run in parallel over $ N $ sequential rounds that progressively search for the best hyperparameters. Each of these jobs launches and monitors a set of $ K $ cross-validation jobs. At each tuning round, $ M \times K $ instances in a Warm Pool are **retained for the next round**. In the subsequent rounds there is no instance startup time.

SageMaker’s `HyperparameterTuner` already makes use of Warm Pools as announced on the [AWS News Blog](https://aws.amazon.com/about-aws/whats-new/2022/08/amazon-sagemaker-automatic-model-tuning-reuses-sagemaker-training-instances-reduce-start-up-overheads/). However, the cross-validation training jobs that are created in each tuning job – that cross-validate a specific combination of hyperparameters – have to be **manually created and monitored, and the provisioned instances are not kept in a Warm Pool**. Each hyperparameter tuning training job will only finish when all the underlying cross-validation training jobs have completed.

To bring the architecture above to life and enable Warm Pools for **all** training jobs, we need to create three main scripts: `pipeline.py`, `cross_validation.py`, and `training.py`:

- **`pipeline.py` script** –-- Defines the SageMaker Pipeline steps described in Section [End-to-End SageMaker Pipeline](#end-to-end-sagemaker-pipeline), which includes SageMaker’s `HyperparameterTuner`:
  {% highlight python %}
  #pipeline.py script
  ...

  # Steps 2 to 5

  tuner = HyperparameterTuner(
  estimator=estimator,
  metric_definitions=[
  {
  "Name": "training:score",
  "Regex": "average model training score:(.*?);"
  },
  {
  "Name": "validation:score",
  "Regex": "average model validation score:(.*?);"
  }
  ],
  objective_metric_name="validation:score",
  strategy="Bayesian",
  max_jobs=max_jobs, # M x N
  max_parallel_jobs=max_parallel_jobs # M
  )

  # Step 2 - Hyperparameter tuning With cross-validation step

  step_tune = TuningStep(
  name="tuning-step",
  step_args=tuner.fit({
  "train": "<s3-path-to-training-folds>",
  "validation": "<s3-path-to-validation-folds>"
  })
  )

  # Step 3 - Optimal hyperparameter retrieval step

  step_lambda = LambdaStep(
  name="get-optimal-hyperparameters-step",
  lambda_func=lambda_get_optimal_hyperparameters,
  inputs={
  "best_training_job_name": step_tune.properties.BestTrainingJob.TrainingJobName,
  },
  outputs=[
  LambdaOutput(output_name="hyperparameter_a"),
  LambdaOutput(output_name="hyperparameter_b"),
  LambdaOutput(output_name="hyperparameter_c")
  ]
  )

  # Step 4 - Final training step

  step_train = TrainingStep(
  name="final-training-step",
  step_args=estimator.fit({"train": "<s3-path-to-full-training-set>"})
  )

  model = Model(
  model_data=step_train.properties.ModelArtifacts.S3ModelArtifacts,
  ...
  )

  # Step 5 - Model registration step

  step_model_registration = ModelStep(
  name="model-registration-step",
  step_args=model.register(.)
  )
  {% endhighlight %}

- **`cross_validation.py` script** --– Serves as entry point of SageMaker’s `HyperparameterTuner`. It launches multiple cross-validation training jobs. It is inside this script that the `keep_alive_period_in_seconds` parameter has to be specified, when calling the SageMaker Training Job API. The script computes and logs the average validation score across all validation folds. Logging the value enables easy reading of that metric using Regex by the `HyperparameterTuner` (as in the code snippet above). This metric is going to be tagged to each combination of hyperparameters.

> **Tip:** Add a small delay, i.e., a few seconds, between the calls to the SageMaker APIs that create and monitor the training jobs to prevent the "Rate Exceeded" error, as in the example:

{% highlight python %}
#cross_validation.py script

import time
...

training_jobs = []
for fold_index in range(number_of_folds):

      # Create cross-validation training jobs (one per fold)
      job = train_model(
          training_data="<training-data-s3-path>"
          validation_data="<validation-data-s3-path>"
          fold_index=fold_index,
          hyperparameters={
              "hyperparameter_a": "<value-of-hyperparameter-a>",
              "hyperparameter_b": "<value-of-hyperparameter-b>",
              "hyperparameter_c": "<value-of-hyperparameter-c>"
      })
      training_jobs.append(job)

      # Add delay to prevent Rate Exceeded error.
      time.sleep(5)

...
{% endhighlight %}

> **Tip:** Disable the [debugger profiler](https://docs.aws.amazon.com/sagemaker/latest/dg/debugger-turn-off.html) when launching your SageMaker training jobs. These profiler instances will be as many as the training instances and can make the overall cost increase significantly. You can do so by simply setting `disable_profiler=True` in the Estimator definition.

- **`training.py` script** –-- Trains a model on a given input training set. The hyperparameters being cross-validated are passed as arguments of this script.

> **Tip:** Write a general-purpose `training.py` script and reuse it for training the model on cross-validation sets and for training the final model with the optimal hyperparameters on the full training set.

To control each parallel cross-validation set of jobs, as well as to compute a final validation metric for each specific hyperparameter combination tested, there are several custom functions that have to be implemented inside the `cross_validation.py` script. [This example](https://github.com/aws-samples/sagemaker-cross-validation-pipeline) provides good inspiration, even though it does not enable Warm Pools or Lambda.

### How many jobs are created in total?

$ M \times N \times (K+1) $ jobs. Why?

- $ M \times N $ hyperparameter tuning training jobs – $ M $ in parallel and $ N $ in sequence – matches the number of hyperparameter combinations.
- $ K $ parallel cross-validation jobs per hyperparameter tuning training job + 1 (the hyperparameter tuning training job itself).

If we have **5** validation folds, run **4** hyperparameter tuning training jobs in parallel and **120** in sequence, then the total **number of jobs will be 2880**.

> **Important:** Make sure that you have all the required service quotas in place for the instance types that you are using. Check the AWS guides to understand how to set these quotas for both [Warm Pools](https://docs.aws.amazon.com/sagemaker/latest/dg/train-warm-pools.html#train-warm-pools-resource-limits) and [Automatic Model Tuning](https://docs.aws.amazon.com/sagemaker/latest/dg/automatic-model-tuning-limits.html).

## What do we get out of using Warm Pools?

Let’s say we want to run $ N=120 $ sequential training jobs and that the startup time of the instances is 3min and that training takes 2min to run (5min per job). This means that the total runtime is approximately:

- _Without_ Warm Pools: 5min x 120 jobs = **10h**
- _With_ Warm Pools: 5min x 1 job + 2min x 119 jobs ≈ **4h**

**This means that with Warm Pools the process takes 60% less time!**

## Summary

In this article, I showed how we can leverage Warm Pools to significantly speed-up hyperparameter tuning with cross-validation in SageMaker Pipelines. Warm Pools are a great feature of SageMaker that not only enables more efficient production pipelines, but also faster iterations in experiments. At the moment, SageMaker Managed Warm Pools have been integrated in SageMaker Training, but not in SageMaker Processing.

_All images unless otherwise noted are by the author._
