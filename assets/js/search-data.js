// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "About",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-blog",
          title: "Blog",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/blog/";
          },
        },{id: "nav-publications",
          title: "Publications",
          description: "publications by categories in reversed chronological order.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-projects",
          title: "Projects",
          description: "A growing collection of your cool projects.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "nav-resume",
          title: "Resume",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/assets/pdf/resume.pdf";
          },
        },{id: "post-fine-tune-mpt-7b-on-amazon-sagemaker",
        
          title: "Fine-tune MPT-7B on Amazon SageMaker",
        
        description: "Learn how to prepare a dataset and create a training job to fine-tune MPT-7B on Amazon SageMaker.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2023/finetune-mpt-7b/";
          
        },
      },{id: "post-fast-and-scalable-hyperparameter-tuning-and-cross-validation-in-aws-sagemaker",
        
          title: "Fast and Scalable Hyperparameter Tuning and Cross-validation in AWS SageMaker",
        
        description: "Using SageMaker Managed Warm Pools.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2023/hyperparameter-tuning/";
          
        },
      },{id: "post-introducing-solar-scan",
        
          title: "Introducing Solar Scan",
        
        description: "A solar potential assessment tool powered by AI.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2019/solarscan/";
          
        },
      },{id: "news-featured-on-aws-build-on-generative-ai-weekly-series",
          title: 'Featured on AWS Build on Generative AI weekly series',
          description: "",
          section: "News",handler: () => {
              window.location.href = "/news/announcement_aws/";
            },},{id: "news-presented-probabilistic-demand-forecasting-with-graph-neural-networks-at-ecml-2023",
          title: 'Presented Probabilistic Demand Forecasting with Graph Neural Networks at ECML 2023',
          description: "",
          section: "News",handler: () => {
              window.location.href = "/news/annoucement_ecml/";
            },},{id: "news-recognized-with-the-global-superstar-award-at-adidas",
          title: 'Recognized with the Global Superstar Award at adidas.',
          description: "",
          section: "News",handler: () => {
              window.location.href = "/news/annoucement_award/";
            },},{id: "projects-money-laundering",
          title: 'Money Laundering',
          description: "Detection of suspicious cases of money laundering using a community-oriented approach.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/anti_money_laundering/";
            },},{id: "projects-deepfake-detection",
          title: 'DeepFake Detection',
          description: "United Nations&#39; Hackathon",
          section: "Projects",handler: () => {
              window.location.href = "/projects/deepfake/";
            },},{id: "projects-fiod-image-intelligence",
          title: 'FIOD Image Intelligence',
          description: "EngD final project with FIOD - Belastingdienst",
          section: "Projects",handler: () => {
              window.location.href = "/projects/fiod_image_intelligence/";
            },},{id: "projects-occupancy-prediction",
          title: 'Occupancy Prediction',
          description: "In working spaces using neural network model.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/occupancy_prediction/";
            },},{id: "projects-dust-particle-detection",
          title: 'Dust Particle Detection',
          description: "In chip-making machines using computer vision.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/particle_detection/";
            },},{id: "projects-power-forecasting",
          title: 'Power Forecasting',
          description: "At MV/LV power substations.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/power_forecasting/";
            },},{id: "projects-recommendation-system",
          title: 'Recommendation System',
          description: "Based on low-rank matrix factorization.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/recommendation_system/";
            },},{id: "projects-solar-scan",
          title: 'Solar Scan',
          description: "Solar potential assessment tool.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/solar_scan/";
            },},{id: "projects-supply-chain-optimization",
          title: 'Supply Chain Optimization',
          description: "Using process mining.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/supply_chain/";
            },},{id: "teachings-data-science-fundamentals",
          title: 'Data Science Fundamentals',
          description: "This course covers the foundational aspects of data science, including data collection, cleaning, analysis, and visualization. Students will learn practical skills for working with real-world datasets.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/data-science-fundamentals/";
            },},{id: "teachings-introduction-to-machine-learning",
          title: 'Introduction to Machine Learning',
          description: "This course provides an introduction to machine learning concepts, algorithms, and applications. Students will learn about supervised and unsupervised learning, model evaluation, and practical implementations.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/introduction-to-machine-learning/";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%6A%6F%61%6F.%70%65%72%65%69%72%61.%61%62%74@%67%6D%61%69%6C.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-scholar',
        title: 'Google Scholar',
        section: 'Socials',
        handler: () => {
          window.open("https://scholar.google.com/citations?user=WCiItYkAAAAJ", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/jpcpereira", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/jpcpereira", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
