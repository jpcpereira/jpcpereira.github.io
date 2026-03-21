---
layout: distill
title: Fine-tune MPT-7B on Amazon SageMaker
description: Learn how to prepare a dataset and create a training job to fine-tune MPT-7B on Amazon SageMaker.
date: 2023-06-20
tags: AI solar-scan
featured: true
giscus_comments: true
thumbnail: assets/img/robot.jpg
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
  - name: Install dependencies and set S3 paths
  - name: Build a fine-tuning dataset
  - name: SageMaker Training job
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

New large language models (LLMs) are being announced every week, each trying to beat its predecessor and take over the evaluation leaderboards. One of the latest models out there is [MPT-7B](https://www.databricks.com/blog/mpt-7b) that was released by MosaicML. Unlike other models of its kind, this 7-billion-parameter model is open-source and licensed for commercial use ([Apache 2.0 license](https://github.com/mosaicml/llm-foundry/blob/main/LICENSE)) 🚀.

Foundation models like [MPT-7B](https://www.databricks.com/blog/mpt-7b) are pre-trained on datasets with trillions of tokens (100 tokens ~ 75 words) crawled from the web and, when prompted well, they can produce impressive outputs. However, to truly unlock the value of large language models in real-world applications, smart prompt-engineering might not be enough to make them work for your use case and, therefore, fine-tuning a foundation model on a domain-specific dataset is required.

LLMs have billions of parameters and, consequently, fine-tuning such large models is challenging. Good news is that fine-tuning is much cheaper and faster as compared to pre-training the foundation model given that 1) the domain-specific datasets are "small" and 2) fine-tuning requires only a few passes over the training data.

**Here is what we will learn in this article:**

- How to create and structure a dataset for fine-tuning a large language model.
- What is and how to configure a distributed training job with fully sharded data parallel.
- How to define a 😊 HuggingFace estimator.
- How to launch a training job in Amazon SageMaker that fine-tunes [MPT-7B](https://www.databricks.com/blog/mpt-7b).

## Install dependencies and set S3 paths

Let's start by installing the [SageMaker Python SDK](https://sagemaker.readthedocs.io/en/stable) and a few other packages. This SDK makes it possible to train and deploy machine learning models on AWS with a few lines of Python code. The code below is available in the [`sagemaker_finetuning.ipynb`](https://github.com/jpcpereira/sagemaker-fine-tune-mpt-7b/blob/main/sagemaker_finetuning.ipynb) notebook on Github. Run the notebook in SageMaker Studio, a SageMaker notebook instance, or in your laptop after [authenticating to an AWS account](https://docs.aws.amazon.com/signin/latest/userguide/command-line-sign-in.html).

{% highlight python %}
!pip install "sagemaker==2.162.0" s3path boto3 --quiet

from sagemaker.huggingface import HuggingFace
from sagemaker.inputs import TrainingInput
from sagemaker import s3_utils
import sagemaker
import boto3
import json
{% endhighlight %}

Next step is to define the paths where the data will be saved in S3 and create a SageMaker session.

{% highlight python %}

# Define S3 paths

bucket = "<YOUR-S3-BUCKET>"
training_data_path = f"s3://{bucket}/toy_data/train/data.jsonl"
test_data_path = f"s3://{bucket}/toy_data/test/data.jsonl"
output_path = f"s3://{bucket}/outputs"
code_location = f"s3://{bucket}/code"

# Create SageMaker session

sagemaker_session = sagemaker.Session()
region = sagemaker_session.boto_region_name
role = sagemaker.get_execution_role()
{% endhighlight %}

## Build a fine-tuning dataset

We will create a dummy dataset to demonstrate how to fine-tune MPT-7B. Since training models of this size on a complete dataset takes long and is costly, it is a good idea to first test & debug the training job on a small dataset and second scale training to the complete dataset.

- **Format dataset as a list of dictionaries** --– The dataset should be formatted as a list of dictionaries, where each example has a key-value structure, _e.g._,

{% highlight python %}
{
"prompt": "What is a Pastel de Nata?",
"response": "A Pastel de Nata is a Portuguese egg custard tart pastry, optionally dusted with cinnamon."
}
{% endhighlight %}

The `prompt` is the input given to the model (_e.g._, a question). The response is the output that the model is trained to predict (_e.g._, the answer to the question in the `prompt`). The raw prompt is often preprocessed to fit in a prompt template that helps the model to generate better outputs. Note that the model is trained for causal language modelling, so you can think of it as a "document completer". It is a good idea to design the prompt template in such a way that the model thinks that it is completing a document. Andrej Karpathy explains well this mechanism in his talk [State of GPT](youtu.be/bZQun8Y4L2A).

{% highlight python %}
prompt_template = """Write a response that appropriately answers the question below.

### Question:

{question}

### Response:

"""

dataset = [
{"prompt": "What is a Pastel de Nata?",
"response": "A Pastel de Nata is a Portuguese egg custard tart pastry, optionally dusted with cinnamon."},
{"prompt": "Which museums are famous in Amsterdam?",
"response": "Amsterdam is home to various world-famous museums, and no trip to the city is complete without stopping by the Rijksmuseum, Van Gogh Museum, or Stedelijk Museum."},
{"prompt": "Where is the European Parliament?",
"response": "Strasbourg is the official seat of the European Parliament."},
{"prompt": "How is the weather in The Netherlands?",
"response": "The Netherlands is a country that boasts a typical maritime climate with mild summers and cold winters."},
{"prompt": "What are Poffertjes?",
"response": "Poffertjes are a traditional Dutch batter treat. Resembling small, fluffy pancakes, they are made with yeast and buckwheat flour."},
]

# Format prompt based on template

for example in dataset:
example["prompt"] = prompt_template.format(question=example["prompt"])

training_data, test_data = dataset[0:4], dataset[4:]

print(f"Size of training data: {len(training_data)}nSize of test data: {len(test_data)}")
{% endhighlight %}

- **Upload the training and test data to S3** –-- Once the training and test sets are ready and formatted as a list of dictionaries, we upload them to S3 as JSON lines using the utility function below:

{% highlight python %}
def write_jsonlines_to_s3(data, s3_path):
"""Writes list of dictionaries as a JSON lines file to S3"""

    json_string = ""
    for d in data:
        json_string += json.dumps(d) + "n"

    s3_client   = boto3.client("s3")

    bucket, key = s3_utils.parse_s3_url(s3_path)
    s3_client.put_object(
        Body   = json_string,
        Bucket = bucket,
        Key    = key,
    )

write_jsonlines_to_s3(training_data, training_data_path)
write_jsonlines_to_s3(test_data, test_data_path)
{% endhighlight %}

## SageMaker Training job

With the datasets available in S3, we will now create a training job in Amazon SageMaker. For that, we have to create an entry point script, modify the configuration file specifying the training settings, and define an HuggingFace estimator. We will (re-)use the training script from [LLM Foundry](https://github.com/mosaicml/llm-foundry) and [Composer](https://github.com/mosaicml/composer) library’s CLI launcher that sets up the distributed training environment. Both of these packages are maintained by [MosaicML](mosaicml.com), the company behind MPT-7B. The working folder should be structured like:

{% highlight python %}
└── fine-tune-mpt-7b-sagemaker/
├── training_script_launcher.sh
├── fine_tuning_config.yaml
├── sagemaker_finetuning.ipynb
{% endhighlight %}

We will now dive deep into each of these files.

- **Create a configuration file [`finetuning_config.yaml`](https://github.com/jpcpereira/sagemaker-fine-tune-mpt-7b/blob/main/finetuning_config.yaml)** --– The template provided in the [LLM Foundry](https://github.com/mosaicml/llm-foundry) repository is a good starting point, specifically the [`mpt-7b-dolly-sft.yaml`](https://github.com/mosaicml/llm-foundry/blob/main/scripts/train/yamls/finetune/mpt-7b_dolly_sft.yaml) file. However, depending on your dataset size and training instance, you might have to adjust some of these configurations, such as the batch size. I have modified the file to fine-tune the model in SageMaker (check [`finetuning_config.yaml`](https://github.com/jpcpereira/sagemaker-fine-tune-mpt-7b/blob/main/finetuning_config.yaml)). The parameters that you should pay attention to are the following:

{% highlight python %}
max_seq_len: 512
global_seed: 17

...

# Dataloaders

train_loader:
name: finetuning
dataset:
hf_name: json
hf_kwargs:
data_dir: /opt/ml/input/data/train/
...

eval_loader:
name: finetuning
dataset:
hf_name: json
hf_kwargs:
data_dir: /opt/ml/input/data/test/

...
max_duration: 3ep
eval_interval: 1ep
...
global_train_batch_size: 128

...

# FSDP

fsdp_config:
sharding_strategy: FULL_SHARD
mixed_precision: PURE
activation_checkpointing: true
activation_checkpointing_reentrant: false
activation_cpu_offload: false
limit_all_gathers: true
verbose: false

# Checkpoint to local filesystem or remote object store

save_folder: /tmp/checkpoints
dist_timeout: 2000
{% endhighlight %}

The `max_seq_length` indicates the maximum number of tokens of the input (remember that 100 tokens ~ 75 words). The training and test data will be loaded using the 😊 [Datasets](https://huggingface.co/docs/datasets/index) library from the `/opt/ml/input/data/{train, test}` directory inside the container associated with the training job. Check out the [SageMaker Training Storage Folders](https://docs.aws.amazon.com/sagemaker/latest/dg/model-train-storage.html)‘ documentation to understand how the container directories are structured. The `max_duration` specifies the number of epochs for fine-tuning. Two to three epochs is typically a good choice. `eval_interval` indicates how often the model will be evaluated on the test set.

The distributed training strategy is Fully Sharded Data Parallel (FSDP), which enables efficient training of large models like MPT-7B. Unlike the traditional data parallel strategy, which keeps a copy of the model in each GPU, FSDP shards model parameters, optimizer states, and gradients across data parallel workers. If you want to learn more about FSDP, check this insightful [PyTorch intro post](https://pytorch.org/blog/introducing-pytorch-fully-sharded-data-parallel-api). FSDP is integrated in [Composer](https://github.com/mosaicml/composer), the distributed training library used by [LLM Foundry](https://github.com/mosaicml/llm-foundry).

`save_folder` determines where the model checkpoint (`.pt` file) is saved. We set it to the temporary folder `/tmp/checkpoints`.

- **Create the entry point script [`launcher.sh`](https://github.com/jpcpereira/sagemaker-fine-tune-mpt-7b/blob/main/launcher.sh)** --— A bash script is used as entry point. The bash script clones the LLM Foundry repository, installs requirements, and, more importantly, runs the training script using Composer library’s distributed launcher. Note that, typically, training jobs in SageMaker run the training script using a command like `python train.py`. However, it is possible to pass a bash script as entry point, which provides more flexibility in our scenario. Finally, we convert the model checkpoint saved to `/tmp/checkpoints` to the HuggingFace model format and save the final artifacts into `/opt/ml/model/`. SageMaker will compress all files in this directory, create a tarball `model.tar.gz`, and upload it to S3. The tarball is useful for inference.

{% highlight python %}

# Clone llm-foundry package from MosaicML

# This is where the training script is hosted

git clone https://github.com/mosaicml/llm-foundry.git
cd llm-foundry

# Install required packages

pip install -e ".[gpu]"
pip install git+https://github.com/mosaicml/composer.git@dev

# Run training script with fine-tuning configuration

composer scripts/train/train.py /opt/ml/code/finetuning_config.yaml

# Convert Composer checkpoint to HuggingFace model format

python scripts/inference/convert_composer_to_hf.py
--composer_path /tmp/checkpoints/latest-rank0.pt
--hf_output_path /opt/ml/model/hf_fine_tuned_model
--output_precision bf16

# Print content of the model artifact directory

ls /opt/ml/model/
{% endhighlight %}

- **Define 😊 HuggingFace Estimator** --– The Estimator sets the Docker container used to run the training job. We will use an image with PyTorch 2.0.0 and Python 3.10. The bash script and the configuration file are automatically uploaded to S3 and made available inside the container (handled by the SageMaker Python SDK). We set the training instance to [`g5.48xlarge`](https://aws.amazon.com/ec2/instance-types/g5) that has 8x NVIDIA A10G GPUs. The [`p4d.24xlarge`](https://aws.amazon.com/ec2/instance-types/p4) is also a good choice. Even though it is more expensive, it is equipped with 8x NVIDIA A100 GPUs. We also indicate the metrics to track on the training and test sets (Cross Entropy and Perplexity). The values of these metrics are captured via Regex expressions and sent to Amazon CloudWatch.

{% highlight python %}

# Define container image for the training job

training_image_uri = f"763104351884.dkr.ecr.{region}.amazonaws.com/huggingface-pytorch-training:2.0.0-transformers4.28.1-gpu-py310-cu118-ubuntu20.04-v1.1"

# Define metrics to send to CloudWatch

metrics = [ # On training set
{"Name": "train:LanguageCrossEntropy",
"Regex": "Train metrics/train/LanguageCrossEntropy: ([+-]?((d+.?d*)|(.d+)))"},
{"Name": "train:LanguagePerplexity",
"Regex": "Train metrics/train/LanguagePerplexity: ([+-]?((d+.?d*)|(.d+)))"}, # On test set
{"Name": "test:LanguageCrossEntropy",
"Regex": "Eval metrics/eval/LanguageCrossEntropy: ([+-]?((d+.?d*)|(.d+)))"},
{"Name": "test:LanguagePerplexity",
"Regex": "Eval metrics/eval/LanguagePerplexity: ([+-]?((d+.?d*)|(.d+)))"},
]

estimator_args = {
"image_uri": training_image_uri, # Training container image
"entry_point": "launcher.sh", # Launcher bash script
"source_dir": ".", # Directory with launcher script and configuration file
"instance_type": "ml.g5.48xlarge", # Instance type
"instance_count": 1, # Number of training instances
"base_job_name": "fine-tune-mpt-7b", # Prefix of the training job name
"role": role, # IAM role
"volume_size": 300, # Size of the EBS volume attached to the instance (GB)
"py_version": "py310", # Python version
"metric_definitions": metrics, # Metrics to track
"output_path": output_path, # S3 location where the model artifact will be uploaded
"code_location": code_location, # S3 location where the source code will be saved
"disable_profiler": True, # Do not create profiler instance
"keep_alive_period_in_seconds": 240, # Enable Warm Pools while experimenting
}

huggingface_estimator = HuggingFace(\*\*estimator_args)
{% endhighlight %}

> ⚠️ Make sure to request the respective quotas for SageMaker Training, along with [Warm Pools](https://docs.aws.amazon.com/sagemaker/latest/dg/train-warm-pools.html)‘ quota in case you are making use of this cool feature. If you plan to run many jobs in SageMaker, take a look at [SageMaker Saving Plans](https://aws.amazon.com/savingsplans/ml-pricing).

- **Launch the training job 🚀** –-- We have all set to start the training job on Amazon SageMaker:

{% highlight python %}
huggingface_estimator.fit({
"train": TrainingInput(
s3_data=training_data_path,
content_type="application/jsonlines"),
"test": TrainingInput(
s3_data=test_data_path,
content_type="application/jsonlines"),
}, wait=True)
{% endhighlight %}

The training time will depend on the size of your dataset. With our dummy dataset, training takes roughly **20min** to complete. Once the model is trained and converted to 😊 HuggingFace format, SageMaker will upload the model tarball (`model.tar.gz`) to the S3 `output_path`. I found that in practice the uploading step takes rather long (>1h), which might be due to the size of the model artifacts to compress (~25GB).

## Summary

In this article, I showed how you can prepare a dataset and create a training job in SageMaker to fine-tune MPT-7B for your use case. The implementation leverages the training script from [LLM Foundry](https://github.com/mosaicml/llm-foundry) and uses [Composer](https://github.com/mosaicml/composer) library’s distributed training launcher. Once you have fine-tuned your model and want to deploy it, I recommend to check out the blog posts by [Philipp Schmid](https://www.philschmid.de); there are plenty of examples on how to deploy LLMs in SageMaker. Have fun with your fine-tuned MPT-7B model! 🎉

All the code used in this article is available on my Github:

> GitHub – jpcpereira/sagemaker-fine-tune-mpt-7b
