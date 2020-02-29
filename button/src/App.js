import React from 'react';

import UIfx from 'uifx';
import mp3File from './beep.mp3';

import 'font-awesome/css/font-awesome.min.css';
import './App.css';

const beep = new UIfx(
  mp3File,
  {
    volume: 1,
    throttleMs: 100,
  }
);

const clickHandler = () => {
  beep.play();
}

const App = () => {
  return (
    <div className="App">
      <header className="App-header">
        <a href="#" className="btn" onClick={clickHandler}>
          <i className="fa fa-bell"></i>
        </a>
      </header>
    </div>
  );
}

export default App;
