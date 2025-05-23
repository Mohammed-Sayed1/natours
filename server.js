/** this is the entry point of the application */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
  console.log('UNHANDLED EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: 'config.env' });
const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

mongoose
  .connect(
    DB,
    // ,
    // /** these are some configurations to deal with deprecation warnings */
    // /** no need for them after mongoose 7 */
    // {
    //   // useNewUrlParser: true,
    //   // useCreateIndex: true,
    //   // useFindAndModify: false,
    //   useNewUrlParser: true,
    //   useUnifiedTopology: true,
    // },
  )
  .then(() => console.log('DB connection successful!'));

// console.log(process.env);

/** START SERVER */
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECRION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log(' 👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
