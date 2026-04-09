export const TEMPLATES = {
  amarillo: {
    backgroundColor: '#fffebe',
    textColor: '#4f2c1d',
    accentColor: '#4c69b2',
    priceColor: '#4c69b2',
    ctaColor: '#4c69b2',
  },
  azul: {
    backgroundColor: '#c8d5ed',
    textColor: '#4f2c1d',
    accentColor: '#4c69b2',
    priceColor: '#4f2c1d',
    ctaColor: '#4c69b2',
  },
  beige: {
    backgroundColor: '#dbc9be',
    textColor: '#4f2c1d',
    accentColor: '#4c69b2',
    priceColor: '#4c69b2',
    ctaColor: '#4f2c1d',
  },
  marron: {
    backgroundColor: '#4f2c1d',
    textColor: '#fffebe',
    accentColor: '#dbc9be',
    priceColor: '#fffebe',
    ctaColor: '#4c69b2',
  },
  azulOscuro: {
    backgroundColor: '#4c69b2',
    textColor: '#FFFFFF',
    accentColor: '#fffebe',
    priceColor: '#fffebe',
    ctaColor: '#4f2c1d',
  },
};

export function getRandomTemplate() {
  const keys = Object.keys(TEMPLATES);
  return TEMPLATES[keys[Math.floor(Math.random() * keys.length)]];
}
