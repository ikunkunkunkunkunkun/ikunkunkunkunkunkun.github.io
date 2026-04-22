var posts=["2026/02/22/SEO博客生产线/","2025/06/18/ai新闻n8n/","2025/01/27/hello-world/","2025/02/13/关于ip检测/","2026/01/22/ai漫剧opal/","2025/02/04/忆昔当年泪不干/","2025/01/20/n8n全自动AI短视频流水线搭建指南/","2026/02/22/部分工具/","2025/01/27/面试基础/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };