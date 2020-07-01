const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI, {useNewUrlParser: true});

app.use(cors())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const exerciseSchema = new mongoose.Schema({ 
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {type: String, required: true, unique: true},
  exercises: [exerciseSchema]
});

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

const findUser = (username, done) => {
  User.findOne({username: username}, (err, user) => {
    if (err) return done(err);
    done(null, user)
  })
}

const createUser = (username, done) => {
  findUser(username, (err, foundUser) => {
  
    if (err || foundUser) return done(err || {"status": 400, "message": "Username already taken"});
    
    let user = new User({
      username: username
    });
    
    user.save((err, user) => {
      if (err) return done(err);
      return done(null, user);
    });
  });
};

app.post("/api/exercise/new-user", (req, res, next) => {
   createUser(req.body.username, (err, user) => {
     if (err) return next(err);
     return res.json({"username": user.username, "_id": user._id});
   });
});

const addExercise = (id, exercise, done) => {
  User.findByIdAndUpdate(id, { $push: { exercises: exercise} }, { new: true }, (err, user) => {
    if (err || !user) return done(err || {status: 404, message: "user not found"});
    let lastExercise = user.exercises[user.exercises.length - 1]; 
    return done(null, {
      _id: id,
      username: user.username,
      description: lastExercise.description,
      duration: lastExercise.duration,
      date: lastExercise.date.toString().split(' ').slice(0, 4).join(' ', ',')
    });
  });
};

const getDate = () => {
  let today = new Date();
     let dd = today.getDate()
     if (dd < 10) dd = "0" + String(dd);
     let mm = today.getMonth() + 1;
     if (mm < 10) mm = "0" + String(mm);
     let yyyy = today.getFullYear();
  
     return yyyy + "-" + mm + "-" + dd;
};

app.post("/api/exercise/add", (req, res, next) => {
   let excercise = new Exercise({
      description: req.body.description,
      duration: req.body.duration,
   });
  
   if (req.body.date) {
     excercise.date = req.body.date;
   } else {
     excercise.date = getDate();
   }
  
   let invalidBody = excercise.validateSync();
   if (invalidBody) return next(invalidBody);
  
   addExercise(req.body.userId, excercise, (err, ex) => {
     if (err) return next(err);
     res.json(ex);
   });
});

app.get("/api/exercise/log", (req, res, next) => {
  let id = req.query.userId;
  if (!id) next({status:400, message: "user id is mandatory"});
  
  let from = Number.MIN_VALUE;
  let dateFrom = new Date(req.query.from)
  if (req.query.from && dateFrom != "Invalid Date" ) {
    from = dateFrom.getTime();
  }
  
  let to = Number.MAX_VALUE;
  let dateTo = new Date(req.query.to)
  if (req.query.to && dateTo != "Invalid Date") {
    to = dateTo.getTime();
  }
  
  let limit = parseInt(req.query.limit);
  
  User.findById(id, (err, user) => {
    if (err) return next(err);    
    let log = user.exercises.filter(ex => ex.date.getTime() >= from && ex.date.getTime() <= to );
    if (limit != NaN && limit >= 0) log = log.slice(0, limit)
    res.json({
      userId: id,
      log: log
    });
  });
});

app.get("/api/exercise/users", (req, res, next) => {
  User.find((err, users) => {
    if (err) return next(err);
    res.json(users);
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});