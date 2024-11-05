import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

const testButton = document.createElement("button");
testButton.innerHTML = "Test";
app.append(testButton);
testButton.addEventListener("click", () => {
  alert("You clicked the button!");
});
