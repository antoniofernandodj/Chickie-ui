import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { interceptConsole } from './app/core/utils/console-interceptor';

// Initialize console interception to send logs to the server
interceptConsole();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
