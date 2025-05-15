// const { type } = require('express/lib/response');
const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');
// const validator = require('validator');

/** SCHEMA: it's like a blueprint defining the structure of data if this collection, types and validations, and this is how to define it using mongoose. */
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal than 40 characters'],
      minlength: [10, 'A tour name must have more or equal than 10 characters'],
      // validate: [
      //   validator.isAlpha, //* note: we don't call the function, we just specify it to tell mongoose that this is a function should be used, like our custom validator function.,
      //   'Tour name must only contain characters.',
      // ],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      //* enum: is a validator just for strings
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium or difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      //* min and max: not only for numbers but also for dates.
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, //* e.g., 4.666 → 46.66 → 47 → 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        //* note: there are libraries that we can plugin here to as custom validators that we do not have to write ourselves, and the most popular library is called validator.js
        validator: function (val) {
          //* this keyword will refare to the current document only when we create a new document, not when update or delete. and this is because the whole mongoose related code runs before going to the database. so in create case I've the object(current document) before going to insert it in the database, but in update or delete cases I don't have the object(document wanna update or delete) before going to the database.
          return val < this.price;
        },
        message: 'Discount price {VALUE} should be below regular price.',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      //* GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [{ type: mongoose.Schema.ObjectId, ref: 'User' }],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// tourSchema.index({price: 1})
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

/** Virtual property: property will not be persisted in the database, but we will get it in the response.
 * it will basically be created each time that we get some data out of the database.
 * so get() function is called a getter, this function will tack a callback function that must be a regular function so we can access 'this' keyword, and 'this' will be pointing to the current document.
 * we can not use this virtual property in a query, because they're technically not part of the database.
 */
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7; //* will be the value of the virtual property, and this is how we calculate the duration in weeks.
});

//* Virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

/** Mongoose Middlewares: like express, we can use them to make something happens between two events, for example we can run a function between the save command is issued and the actual saving of the document, or also after the actual saving, and that is why they called pre and post hooks.
 * there are 4 types of middleware in mongoose: document, query, aggregate and model
 * 'save' is one of the hooks, and we can have multiple pre and post middlewares for the same hook.
 */
//* DOCUMENT MIDDLEWARE: can act on the currently processed document, run before .save() and .create(). and its called pre save hook.
tourSchema.pre('save', function (next) {
  //* this callback function will be called before an actual document is saved to the database.
  this.slug = slugify(this.name, { lower: true }); //* 'this' keyword is ganna point to the currently processed document.
  next(); //* because this is a middleware, it has an access to next() function to call the next middleware.
});

// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// tourSchema.pre('save', function (next) {
//   console.log('Will save document...');
//   next();
// });

// //* the post middleware is executed after all the pre middleware functins have completed.
// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
// });

//* QUERY MIDDLEWARE:
//* pre find middleware
// tourSchema.pre('find', function (next) {
tourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } });

  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

tourSchema.post(/^find/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds!`);
  // console.log(docs);
  next();
});

//* AGGREGATION MIDDLEWARE:
// tourSchema.pre('aggregate', function (next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });

//   console.log(this.pipeline());
//   next();
// });

/** MODEL: the model is like a wrapper around the schema, and this is how to define it using mongoose.
 * the first argument will be the name of the created collection in lowercase and plural like this 'tours'.
 */
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
