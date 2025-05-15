class AppError extends Error {
    constructor(message, statusCode) {
        super(message)

        this.statusCode = statusCode
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'
        this.isOperational = true

        Error.captureStackTrace(this, this.constructor) //* this line is not needed after nodejs 10, used to exculde any instance form this error class from stack trace that is build in Error object.
    }
}

module.exports = AppError;