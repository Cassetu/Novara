const correctSound = new Audio("assets/sfx/correct.mp3");
const incorrectSound = new Audio("assets/sfx/incorrect.mp3");

function playCorrect() {
    correctSound.currentTime = 0;
    correctSound.play();
}

function playIncorrect() {
    incorrectSound.currentTime = 0;
    incorrectSound.play();
}

export { playCorrect, playIncorrect };