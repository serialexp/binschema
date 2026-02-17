import { resolve } from 'path';

export default {
  server: {
    host: '0.0.0.0',
    allowedHosts: ['home.serial-experiments.com', 'localhost']
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        playground: resolve(import.meta.dirname, 'playground.html'),
      },
    },
  },
}
