export const TEMPLATES = {
  dark: {
    backgroundColor: '#1a1a2e',
    textColor: '#FFFFFF',
    accentColor: '#E94560',
    priceColor: '#FF6B6B',
    ctaColor: '#E94560',
  },
  light: {
    backgroundColor: '#F5F5F5',
    textColor: '#1a1a2e',
    accentColor: '#0F3460',
    priceColor: '#E94560',
    ctaColor: '#0F3460',
  },
  vibrant: {
    backgroundColor: '#16213E',
    textColor: '#FFFFFF',
    accentColor: '#E94560',
    priceColor: '#FFC300',
    ctaColor: '#E94560',
  },
};

export function getRandomTemplate() {
  const keys = Object.keys(TEMPLATES);
  return TEMPLATES[keys[Math.floor(Math.random() * keys.length)]];
}
