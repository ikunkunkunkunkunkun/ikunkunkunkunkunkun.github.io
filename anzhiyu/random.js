var posts=["2025/02/04/Try/","2025/01/27/hello-world/","2025/02/16/Post-Front-matte/","2025/01/20/ikun圣地/","2025/02/13/kk/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };