const squatOrder = [1, 2, 3, 3, 3, 3, 2, 1];
const frameMs = 80;

const trainerButton = document.getElementById("trainer-button");
const trainerImage = document.getElementById("trainer-image");
const mushroom = document.getElementById("mushroom");
const squatCount = document.getElementById("count");

let animating = false;
let mushroomScale = 1;
let count = 0;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRandomMushroom() {
  const id = Math.floor(Math.random() * 4) + 1;
  mushroom.src = `images/kinoko_${id}.webp`;
}

function growMushroom() {
  mushroomScale += 0.05;
  mushroom.style.transform = `scale(${mushroomScale.toFixed(2)})`;
}

function squatCountPlas() {
  count += 1;
  squatCount.textContent = `${count}回`

}

async function playSquat() {
  if (animating) {
    return;
  }

  animating = true;
  trainerButton.disabled = true;

  for (const frame of squatOrder) {
    trainerImage.src = `images/${frame}.webp`;
    await wait(frameMs);
  }

  growMushroom();
  squatCountPlas();
  trainerButton.disabled = false;
  animating = false;
}

pickRandomMushroom();
trainerButton.addEventListener("click", playSquat);
