const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

// upload.single('image') => req.file
// upload.array('images', 5) => req.files

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  //* 1) Cover image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  //* 2) Images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    }),
  );

  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  /** Note: Tour.aggregate() pipeline: will return an aggregate object that kind of Promise, so only when we await it, it comes back with the result.
   * we use the below aggregate() function to make some calculations on the returned data, so after geting the tours with a ratingsAverage >= 4.5, then calculate there avgRating, avgPrice, minPrice and maxPrice.
   * every object in the pipeline array is called a stage.
   */
  const stats = await Tour.aggregate([
    { $match: { ratingsAverage: { $gte: 4.5 } } },
    {
      $group: {
        _id: { $toUpper: '$difficulty' }, //* we using _id to specify what we want to group by. by assigning it to null we tell it to get all statistics in one group and not in sepatated groups. so if I set its value to '$difficulty' this will get all 'easy' tours and make the calculations on them and the same for 'meddium' and 'difficult'.
        numTours: { $sum: 1 }, //* wanna get number of tours, so this works as a counter , we sum 1 for every document.
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 }, //* we sort using the previous stage names that is $group stage, we can no longer use the original names because at this point these names are gone. here we sort by average price and setting the value to 1 for ascending.
    },
    // {
    //   $match: { _id: { $ne: 'EASY' } }, //* we can repeat stages like this $match stage, and here we select all groups except the one with easy difficulty.
    // },
  ]);

  res.status(200).json({
    status: 'success',
    results: stats.length,
    data: {
      stats,
    },
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;

  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates', //* what unwind do: is to diconstruct an array fields from th input document and then output one document for each element of the array. so we get one tour document for each of these dates in the array.
    },
    {
      $match: {
        //* we can do this because MongoDB works perfectly with dates.
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' }, //* this $month operator extracts the month part from a full date.
        numToursStarts: { $sum: 1 }, //* calculate number of documents grouped for each month.
        tours: { $push: '$name' }, //* this $push operator creates an array.
      },
    },
    {
      $addFields: { month: '$_id' }, //* add field called month and assign its value form _id property.
    },
    {
      //* this stage works by giving each of the field names a 0 or 1 to specify which field to show and which to hide.
      $project: {
        _id: 0,
      },
    },
    {
      $sort: { numToursStarts: -1 }, //* by using -1 it sorts the result discending.
    },
    {
      $limit: 12, //* this limit is more than the number of result documents, so it will return the whole 10 documents.
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      results: plan.length,
      plan,
    },
  });
});

//* /tours-within/:distance/center/:latlng/unit/:unit
//* /tours-within/233/center/34.111745,-118.113491/unit/mi
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    return next(
      new AppError(
        'Please provide latitude and longitude in the format lat, lng.',
        400,
      ),
    );
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res
    .status(200)
    .json({ status: 'success', results: tours.length, data: { data: tours } });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    return next(
      new AppError(
        'Please provide latitude and longitude in the format lat, lng.',
        400,
      ),
    );
  }

  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier,
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    stauts: 'success',
    results: distances.length,
    data: { data: distances },
  });
});
