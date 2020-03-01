import React from 'react';

// Sounds
import mp3Beep from './sounds/beep.mp3';

// CSS
import 'font-awesome/css/font-awesome.min.css';
import './App.css';

// Preload beep sound
const beep = new Audio(mp3Beep);
beep.load();

// Set a super secret API key -- eventually obtained via login
const alertAppToken = 'top_secret_alert_token';

// Event handler for button click
const clickHandler = () => {
  // Play sound and trigger state change for animations
  beep.play();

  // Send request to API
  fetch('http://192.168.85.72:4000/alert', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `appToken=${alertAppToken}`,
  })
  .then((res) => {
    return res.json();
  })
  .then((resdata) => {
    console.log('resdata', resdata);
    if (resdata.status === 'error') {
      // Failed to trigger alert
      return alert(`Error: ${resdata.message}`);
    }

    if (resdata.status === 'triggered') {
      // Successfully triggered an alert
      alert('SUCCESS');

    }
  });
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
