var express = require("express");
var mongoose = require("mongoose");
var passport = require('passport');
var LocalStrategy = require('passport-local');
var bodyParser = require("body-parser");
var methodOverride = require("method-override");
var expressSanitizer = require("express-sanitizer");
var app = express();
//Models Require
var Blog = require("./models/blog");
var User = require("./models/user");
var Comment = require("./models/comments");
var seedDB = require('./seeds');

const callMongose= async()=>{
  await mongoose.connect("mongodb://mongo:27017/Sadblog", {
    useNewUrlParser: true,
    useUnifiedTopology:true
  });
}
callMongose()

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(methodOverride("_method"));
app.use(expressSanitizer());
/////////////////////////////////////////
mongoose.set('useFindAndModify', false);
////////////////////////////////////////
app.use(require("express-session")({
  secret:"kiba",
  resave:false,
  saveUninitialized:false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
//Use current user in every Route
app.use(function(req,res,next){
  res.locals.currentUser = req.user;
  next();
});

// seedDB();


//INDEX
app.get("/", function(req, res) {
  res.redirect("/blogs");
});
app.get("/blogs", function(req, res) {
  Blog.find({}, function(err, blogs) {
    if (err) {
      console.log('err', err);
    } else {
      res.render("blog/index", {
        blogs: blogs
      });
    }
  })
});
//NEW route
app.get("/blogs/new", function(req, res) {
  res.render("blog/new");
});
//CREATE route
app.post("/blogs",isLoggedIn,function(req, res) {
  var title = req.body.blog.title;
  var image = req.body.blog.image;
  var body  = req.body.blog.body;
  var created = req.body.blog.created;
  var author = {
    id:req.user._id,
    username:req.user.username
  }
  req.body.blog.body = req.sanitize(req.body.blog.body);
  var addBlog = {
    title:title,
    image:image,
    body:body,
    created:created,
    author:author
  }
  Blog.create(addBlog, function(err, newBlog) {
    if (err) {
      res.render("blog/new");
    } else {
      res.redirect("/blogs");
    }
  });
});
//SHOW route
app.get("/blogs/:id", function(req, res) {
  Blog.findById(req.params.id).populate("comments").exec( function(err, foundBlog) {
    if (err) {
      res.redirect("/blogs");
    } else {
      console.log(foundBlog);
      res.render("blog/show", {
        blog: foundBlog,
      });
    }
  });
});
//EDIT route
app.get("/blogs/:id/edit",function(req, res) {
  Blog.findById(req.params.id, function(err, foundBlog) {
    if (err) {
      res.redirect("/blogs");
    } else {
      res.render("blog/edit", {
        blog: foundBlog
      });
    }
  });
});
//UPDATE Route
app.put("/blogs/:id",function(req, res) {
  req.body.blog.body = req.sanitize(req.body.blog.body);
  Blog.findByIdAndUpdate(req.params.id, req.body.blog, function(err, updatedBlog) {
    if (err) {
      res.redirect("/blogs");
    } else {
      res.redirect("/blogs/" + req.params.id);
    }
  });
});
//DELETE route
app.delete("/blogs/:id",checkOwnership,function(req, res) {
  Blog.findByIdAndRemove(req.params.id, function(err) {
    if (err) {
      res.redirect("/blogs");
    } else {
      res.redirect("/blogs");
    }
  });
});
//Register Route
app.get("/register",function (req,res) {
  res.render("register");
});


app.post("/register",function (req, res) {
  var newUser = new User({username: req.body.username});
  User.register(newUser,req.body.password,function (err,user) {
    if (err) {
      console.log('err:', err);
      return res.render("register");
    }
    passport.authenticate("local")(req, res,function () {

      res.redirect("/blogs");
    });
  });
});
//LOGIN routes
app.get("/login",function (req, res) {
  res.render("login");
});
app.post("/login",passport.authenticate("local",{
  successRedirect:"/blogs",
  failureRedirect:"/login"

}),function(req, res) {
  // res.send("login logic hrouterens");
});

app.get("/logout",function (req, res) {
  //comes with the packages that are installed
  req.logout();
  res.redirect("/blogs");
});

// COMMENTS route
app.get("/blogs/:id/comments/new",isLoggedIn,function (req, res) {
  Blog.findById(req.params.id,function (err,blog) {
      if (err) {
        console.log('err', err);
      } else {
        res.render("comments/new",{blog:blog});
      }
  });
});

app.post("/blogs/:id/comments",isLoggedIn,function (req, res) {
Blog.findById(req.params.id,function (err,blog) {
    if (err) {
      console.log('err:', err);
    } else {
      console.log('blog:', blog);
      Comment.create(req.body.comment,function (err,comment) {
          if (err) {
            console.log('err:', err);
          }else{
            comment.author.id = req.user._id;
            comment.author.username =req.user.username;
            blog.comments.push(comment);
            //save comment
            comment.save();
            blog.save();
            res.redirect("/blogs/"+blog._id);
            // console.log(req.body.comment);
          }
          });
        }
      })
    });


//Middleware
    function isLoggedIn(req, res, next){
      if (req.isAuthenticated()) {
        return next();
      } else {
        res.redirect("/login");
      }
    }
    function checkOwnership(req,res,next) {
      if (req.isAuthenticated()) {
        Blog.findById(req.params.id,function (err,foundBlog) {
          if (err) {
            res.redirect("back");
          } else {
              //does the user own the blog
              if (foundBlog.author.id.equals(req.user._id)) {
                next();
              } else {
                res.redirect("back");
              }
          }
        });
      } else {
        res.redirect("back");
      }
    }
app.listen(9080, function() {
  console.log("server is up");
});
