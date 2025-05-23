const AppError = require('../utils/appError');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const message = `Duplicate field value: ${err.keyValue.name}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);

  const message = `Ivalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Yout token is expired!, Please log in again.', 401);

const sendErrorDev = (err, req, res) => {
  //* A) API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }
  //* B) RENDERED WEBSITE
  console.error('Error 💥', err);
  return res
    .status(err.statusCode)
    .render('error', { title: 'Something went wrong!', msg: err.message });
};

const sendErrorProd = (err, req, res) => {
  //* A) API
  if (req.originalUrl.startsWith('/api')) {
    //* A) Operational (thrown using our AppError class), trusted error: send messageto client
    if (err.isOperational) {
      return res
        .status(err.statusCode)
        .json({ status: err.status, message: err.message });
    }

    //* B) Programming or other unknown error (mongoose's error): don't leak error details
    //* 1) Log error
    console.error('Error 💥', err);
    //* 2) Send generic message
    return res
      .status(500)
      .json({ status: 'error', message: 'Something went very wrong!' });
  }

  //* B) RENDERED WEBSITE
  //* A) Operational (thrown using our AppError class), trusted error: send messageto client
  if (err.isOperational) {
    return res
      .status(err.statusCode)
      .render('error', { title: 'Something went wrong!', msg: err.message });
  }

  //* B) Programming or other unknown error (mongoose's error): don't leak error details
  //* 1) Log error
  console.error('Error 💥', err);
  //* 2) Send generic message
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Please try again later.',
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    // let error = JSON.parse(JSON.stringify(err)); //* use this to make a deep copy, because the distructuring way make a shallow copy, that may result with a missing props.
    let error = { ...err }; //* Preserves most properties
    error.message = err.message;

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};
