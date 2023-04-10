import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Route } from 'react-router-dom';

import './index.css';
import Button from './Button';
import * as serviceWorker from './serviceWorker';

ReactDOM.render(
  <BrowserRouter>
    <Route component={ Button } path='/' />
  </BrowserRouter>,
  document.getElementById('root'),
);

// Register service worker
serviceWorker.register();
