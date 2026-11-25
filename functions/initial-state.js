export function withInventoryCatalog(state) {
  if (!state.ingredients.some(ingredient => ingredient.id === 'ing_nuggets')) {
    state.ingredients.push({ id: 'ing_nuggets', code: 'IN-14', name: 'Nuggets', station: 'COCINA', unit: 'und', stock: 0, minStock: 0, cost: 0 });
  }
  return state;
}

export function initialState() {
  const state = {
    counters: { order: 0, boleta: 0, kardex: 0 },
    ingredients: [
      { id: 'ing_carne', code: 'IN-01', name: 'Carne Asado de Tira', station: 'COCINA', unit: 'g', stock: 8500, minStock: 2000, cost: 0.032 },
      { id: 'ing_pan', code: 'IN-02', name: 'Pan Brioche', station: 'COCINA', unit: 'und', stock: 48, minStock: 15, cost: 1.50 },
      { id: 'ing_papas', code: 'IN-03', name: 'Papas Nativas (Porción)', station: 'COCINA', unit: 'porc', stock: 62, minStock: 18, cost: 2.20 },
      { id: 'ing_alitas', code: 'IN-04', name: 'Alitas de Pollo', station: 'COCINA', unit: 'und', stock: 120, minStock: 36, cost: 1.10 },
      { id: 'ing_salchicha', code: 'IN-05', name: 'Salchicha Ahumada', station: 'COCINA', unit: 'porc', stock: 40, minStock: 12, cost: 2.80 },
      { id: 'ing_cheddar', code: 'IN-06', name: 'Queso Cheddar (Lámina)', station: 'COCINA', unit: 'und', stock: 55, minStock: 15, cost: 1.20 },
      { id: 'ing_tocino', code: 'IN-07', name: 'Tocino Ahumado (Porción)', station: 'COCINA', unit: 'porc', stock: 34, minStock: 10, cost: 2.00 },
      { id: 'ing_huevo', code: 'IN-08', name: 'Huevo', station: 'COCINA', unit: 'und', stock: 42, minStock: 12, cost: 0.60 },
      { id: 'ing_pollo', code: 'IN-09', name: 'Pollo Broster / Desmenuzado', station: 'COCINA', unit: 'porc', stock: 26, minStock: 8, cost: 4.50 },
      { id: 'ing_gaseosa', code: 'IN-10', name: 'Gaseosas / Agua', station: 'BARRA', unit: 'bot', stock: 64, minStock: 18, cost: 2.30 },
      { id: 'ing_pulpa', code: 'IN-11', name: 'Pulpas / Bases Frappe y Jarra', station: 'BARRA', unit: 'porc', stock: 35, minStock: 10, cost: 3.00 },
      { id: 'ing_pisco', code: 'IN-12', name: 'Pisco / Destilados Blancos', station: 'BARRA', unit: 'oz', stock: 90, minStock: 24, cost: 2.50 },
      { id: 'ing_ron', code: 'IN-13', name: 'Ron / Licores Barra', station: 'BARRA', unit: 'oz', stock: 84, minStock: 24, cost: 2.40 }
    ],
    suppliers: [],
    purchases: [],
    orders: [],
    kardex: [],
    caja: { opening: 0, movements: [] },
    boletas: []
  };
  for (const ingredient of state.ingredients) ingredient.stock = 0;
  return withInventoryCatalog(state);
}
