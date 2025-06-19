html, body {
  margin: 0;
  overflow: hidden;
  background: #111;
  font-family: Arial, sans-serif;
  height: 100%;
}

#menu {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  text-align: center;
  background: rgba(0,0,0,0.8);
  padding: 30px 50px;
  border-radius: 10px;
  user-select: none;
}

#menu input {
  font-size: 18px;
  padding: 8px;
  margin-top: 10px;
  width: 200px;
  border-radius: 5px;
  border: none;
  outline: none;
}

#menu button {
  margin-top: 15px;
  font-size: 18px;
  padding: 10px 20px;
  cursor: pointer;
  border-radius: 5px;
  border: none;
  background: #4CAF50;
  color: white;
}

#score {
  position: absolute;
  top: 10px;
  left: 10px;
  color: white;
  font-size: 18px;
  z-index: 10;
}

canvas {
  display: block;
}
