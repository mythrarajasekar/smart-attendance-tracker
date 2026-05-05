// Mock for morgan HTTP logger — not needed in test environment
const morgan = () => (_req: unknown, _res: unknown, next: () => void) => next();
morgan.token = () => morgan;
morgan.format = () => morgan;
morgan.compile = () => () => '';
export = morgan;
