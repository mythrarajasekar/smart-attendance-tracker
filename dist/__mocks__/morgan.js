"use strict";
// Mock for morgan HTTP logger — not needed in test environment
const morgan = () => (_req, _res, next) => next();
morgan.token = () => morgan;
morgan.format = () => morgan;
morgan.compile = () => () => '';
module.exports = morgan;
