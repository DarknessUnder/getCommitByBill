var WIDTH = document.getElementById("volume-meter").width;
var HEIGHT = document.getElementById("volume-meter").height;

var canvasContext = document.getElementById("volume-meter").getContext("2d");
canvasContext.translate(WIDTH / 2, HEIGHT / 2);
canvasContext.scale(1, -1);
var audioContext;
var meter;

audioContext = new AudioContext();

document.body.addEventListener("mouseenter", function (event) {
  audioContext.resume();
  var stream = navigator.getUserMedia(
    {
      audio: {
        mandatory: {
          googEchoCancellation: "false",
          googAutoGainControl: "false",
          googNoiseSuppression: "false",
          googHighpassFilter: "false",
        },
        optional: [],
      },
    },
    streamgood,
    streamnotgood
  );
});

function streamnotgood() {
  alert("Stream generation failed.");
}

function streamgood(stream) {
  meter = createAudioMeter(audioContext);

  var mediaStreamSource = audioContext.createMediaStreamSource(stream);
  mediaStreamSource.connect(meter);

  // kick off the visual updating
  drawLoop();
}

function drawLoop(time) {
  // clear the background
  canvasContext.clearRect(WIDTH / -2, HEIGHT / -2, WIDTH, HEIGHT);

  // check if we're currently clipping
  if (meter.checkClipping()) canvasContext.fillStyle = "red";
  else canvasContext.fillStyle = "green";

  // draw a bar based on the current volume
  canvasContext.fillRect(WIDTH / -2, HEIGHT / -2, WIDTH, HEIGHT * meter.volume);

  // set up the next visual callback
  rafID = window.requestAnimationFrame(drawLoop);
}

function createAudioMeter(audioContext, clipLevel, averaging, clipLag) {
  var processor = audioContext.createScriptProcessor(512);
  processor.onaudioprocess = volumeAudioProcess;
  processor.clipping = false;
  processor.lastClip = 0;
  processor.volume = 0;
  processor.clipLevel = clipLevel || 0.98;
  processor.averaging = averaging || 0.95;
  processor.clipLag = clipLag || 750;

  // this will have no effect, since we don't copy the input to the output,
  // but works around a current Chrome bug.
  processor.connect(audioContext.destination);

  processor.checkClipping = function () {
    if (!this.clipping) return false;
    if (this.lastClip + this.clipLag < window.performance.now())
      this.clipping = false;
    return this.clipping;
  };

  processor.shutdown = function () {
    this.disconnect();
    this.onaudioprocess = null;
  };

  return processor;
}

function volumeAudioProcess(event) {
  var buf = event.inputBuffer.getChannelData(0);
  var bufLength = buf.length;
  var sum = 0;
  var x;

  // Do a root-mean-square on the samples: sum up the squares...
  for (var i = 0; i < bufLength; i++) {
    x = buf[i];
    if (Math.abs(x) >= this.clipLevel) {
      this.clipping = true;
      this.lastClip = window.performance.now();
    }
    sum += x * x;
  }

  // ... then take the square root of the sum.
  var rms = Math.sqrt(sum / bufLength);

  // Now smooth this out with the averaging factor applied
  // to the previous sample - take the max here because we
  // want "fast attack, slow release."
  this.volume = Math.max(rms, this.volume * this.averaging);
}
