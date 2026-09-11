import './styles.css';
import { App } from './App';

const app = new App();
void app.start().catch((err) => {
  console.error('FRACTURE CITY failed to boot', err);
  const loader = document.getElementById('loader');
  if (loader) {
    loader.innerHTML = `<div class="loader__boot"><div class="loader__mark">FC</div>
      <div class="loader__line is-active">STRUCTURAL FAILURE — SEE CONSOLE</div></div>`;
  }
});
