export const WING_FLAVORS = [
  'Crispy (Brothers)',
  'BBQ y Más',
  'Acevichadas (La Gringa)',
  'Buffalo (Vuela y Pica)',
  'Honey Mustard',
  'Maracumango Habanero'
];

export const EXTRAS = [
  { id: 'ex_huevo', name: 'Huevo', price: 4.00, ingId: 'ing_huevo', qty: 1 },
  { id: 'ex_tocino', name: 'Tocino', price: 4.00, ingId: 'ing_tocino', qty: 1 },
  { id: 'ex_cheddar', name: 'Queso Cheddar', price: 4.00, ingId: 'ing_cheddar', qty: 1 },
  { id: 'ex_salchicha', name: 'Porción Salchicha Ahumada', price: 8.00, ingId: 'ing_salchicha', qty: 1 }
];

// Real 5-page menu from "Carta The Burgers Brother.pdf"
export const MENU = [
  // Page 1: Hamburguesas
  { id: 'm1', name: 'Burger Classic', cat: 'Hamburguesas', station: 'COCINA', price: 14.00, desc: 'Asado de tira 150g, tomate, cebolla blanca, lechuga, papas nativas, pan brioche.', recipe: [{ id: 'ing_carne', qty: 150 }, { id: 'ing_pan', qty: 1 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm2', name: 'Classic 2.0', cat: 'Hamburguesas', station: 'COCINA', price: 16.00, desc: 'Asado de tira 150g, lechuga, tomate, queso cheddar, cebolla blanca, papas nativas.', recipe: [{ id: 'ing_carne', qty: 150 }, { id: 'ing_pan', qty: 1 }, { id: 'ing_cheddar', qty: 1 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm3', name: 'Burger Cheese', cat: 'Hamburguesas', station: 'COCINA', price: 18.00, desc: 'Asado de tira 150g, lechuga, tocino, tomate, queso cheddar y papas nativas.', recipe: [{ id: 'ing_carne', qty: 150 }, { id: 'ing_pan', qty: 1 }, { id: 'ing_cheddar', qty: 1 }, { id: 'ing_tocino', qty: 1 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm4', name: 'Burger Royal', cat: 'Hamburguesas', station: 'COCINA', price: 24.00, desc: 'Asado de tira 200g, tocino, huevo, tomate, queso cheddar, lechuga, papas nativas.', recipe: [{ id: 'ing_carne', qty: 200 }, { id: 'ing_pan', qty: 1 }, { id: 'ing_cheddar', qty: 1 }, { id: 'ing_tocino', qty: 1 }, { id: 'ing_huevo', qty: 1 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm5', name: 'Big Bacon', cat: 'Hamburguesas', station: 'COCINA', price: 30.00, desc: 'Asado de tira 240g, tocino, huevo, tomate, doble cheddar, mermelada de tocino, papas nativas.', recipe: [{ id: 'ing_carne', qty: 240 }, { id: 'ing_pan', qty: 1 }, { id: 'ing_cheddar', qty: 2 }, { id: 'ing_tocino', qty: 2 }, { id: 'ing_huevo', qty: 1 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm6', name: 'Burger Brother', cat: 'Hamburguesas', station: 'COCINA', price: 34.00, desc: 'Doble burger asado de tira 250g, cebolla crispy, lechuga, doble tocino, doble queso, papas nativas, pan brioche.', recipe: [{ id: 'ing_carne', qty: 250 }, { id: 'ing_pan', qty: 1 }, { id: 'ing_cheddar', qty: 2 }, { id: 'ing_tocino', qty: 2 }, { id: 'ing_papas', qty: 1 }] },

  // Page 2: Alitas & Combos
  { id: 'm7', name: 'Alitas Brothers (Crispy)', cat: 'Alitas y Combos', station: 'COCINA', price: 15.00, desc: 'Alitas crispy acompañadas de papas nativas.', recipe: [{ id: 'ing_alitas', qty: 6 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm8', name: 'Ala BBQ y Más', cat: 'Alitas y Combos', station: 'COCINA', price: 15.00, desc: 'Alitas a la BBQ acompañadas de papas nativas.', recipe: [{ id: 'ing_alitas', qty: 6 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm9', name: 'Alitas La Gringa (Acevichadas)', cat: 'Alitas y Combos', station: 'COCINA', price: 15.00, desc: 'Alitas acevichadas acompañadas de papas nativas.', recipe: [{ id: 'ing_alitas', qty: 6 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm10', name: 'Alitas Vuela y Pica (Buffalo)', cat: 'Alitas y Combos', station: 'COCINA', price: 15.00, desc: 'Alitas al buffalo acompañadas de papas nativas.', recipe: [{ id: 'ing_alitas', qty: 6 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm11', name: 'Alitas Honey Mustard', cat: 'Alitas y Combos', station: 'COCINA', price: 15.00, desc: 'Alitas en salsa de mostaza y miel con papas nativas.', recipe: [{ id: 'ing_alitas', qty: 6 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm12', name: 'Alitas Maracumango Habanero', cat: 'Alitas y Combos', station: 'COCINA', price: 15.00, desc: 'Salsa de mango dulce y habanero picante con papas nativas.', recipe: [{ id: 'ing_alitas', qty: 6 }, { id: 'ing_papas', qty: 1 }] },
  { id: 'm13', name: 'Combo La Sabrosa (6 Alitas)', cat: 'Alitas y Combos', station: 'COCINA', price: 22.00, flavorsRequired: 2, desc: '6 alitas en 2 sabores + papas nativas con salchicha ahumada.', recipe: [{ id: 'ing_alitas', qty: 6 }, { id: 'ing_papas', qty: 1 }, { id: 'ing_salchicha', qty: 1 }] },
  { id: 'm14', name: 'Combo Alas, Risas y Salsas (12)', cat: 'Alitas y Combos', station: 'COCINA', price: 38.00, flavorsRequired: 4, desc: '12 alitas en 4 sabores + papas nativas con salchicha ahumada.', recipe: [{ id: 'ing_alitas', qty: 12 }, { id: 'ing_papas', qty: 2 }, { id: 'ing_salchicha', qty: 1 }] },
  { id: 'm15', name: 'Combo Brothers (18 Alitas)', cat: 'Alitas y Combos', station: 'COCINA', price: 52.00, flavorsRequired: 4, desc: '18 alitas en 4 sabores + papas nativas con salchicha ahumada.', recipe: [{ id: 'ing_alitas', qty: 18 }, { id: 'ing_papas', qty: 2 }, { id: 'ing_salchicha', qty: 2 }] },
  { id: 'm16', name: 'Combo Vuelo y Sazón (24 Alitas)', cat: 'Alitas y Combos', station: 'COCINA', price: 68.00, flavorsRequired: 6, desc: '24 alitas en todos los sabores + papas nativas con salchicha ahumada.', recipe: [{ id: 'ing_alitas', qty: 24 }, { id: 'ing_papas', qty: 3 }, { id: 'ing_salchicha', qty: 2 }] },

  // Page 4: Salchipapas y Broster
  { id: 'm17', name: 'Cononuggets', cat: 'Salchipapas y Broster', station: 'COCINA', price: 7.00, desc: 'Papas nativas con salchicha ahumada y nuggets.', recipe: [{ id: 'ing_papas', qty: 1 }, { id: 'ing_salchicha', qty: 1 }] },
  { id: 'm18', name: 'Salchipapa', cat: 'Salchipapas y Broster', station: 'COCINA', price: 12.00, desc: 'Papas nativas acompañado de salchicha ahumada.', recipe: [{ id: 'ing_papas', qty: 1 }, { id: 'ing_salchicha', qty: 1 }] },
  { id: 'm19', name: 'Pollo Broster', cat: 'Salchipapas y Broster', station: 'COCINA', price: 14.00, desc: 'Papas nativas, salchicha ahumada y pollo broster.', recipe: [{ id: 'ing_papas', qty: 1 }, { id: 'ing_salchicha', qty: 1 }, { id: 'ing_pollo', qty: 1 }] },
  { id: 'm20', name: 'Salchipollo', cat: 'Salchipapas y Broster', station: 'COCINA', price: 15.00, desc: 'Papas nativas, salchicha ahumada y pollo desmenuzado.', recipe: [{ id: 'ing_papas', qty: 1 }, { id: 'ing_salchicha', qty: 1 }, { id: 'ing_pollo', qty: 1 }] },
  { id: 'm21', name: 'Salchipapa Cheese', cat: 'Salchipapas y Broster', station: 'COCINA', price: 17.00, desc: 'Papas nativas, salchicha ahumada y queso fundido.', recipe: [{ id: 'ing_papas', qty: 1 }, { id: 'ing_salchicha', qty: 1 }, { id: 'ing_cheddar', qty: 2 }] },
  { id: 'm22', name: 'Chanchipapa', cat: 'Salchipapas y Broster', station: 'COCINA', price: 19.00, desc: 'Papas nativas, salchicha ahumada, doble huevo y tocino.', recipe: [{ id: 'ing_papas', qty: 1 }, { id: 'ing_salchicha', qty: 1 }, { id: 'ing_huevo', qty: 2 }, { id: 'ing_tocino', qty: 1 }] },
  { id: 'm23', name: 'Salchipapa Especial', cat: 'Salchipapas y Broster', station: 'COCINA', price: 23.00, desc: 'Papas nativas, salchicha ahumada, salchicha arequipeña, huevo y pollo desmenuzado.', recipe: [{ id: 'ing_papas', qty: 1 }, { id: 'ing_salchicha', qty: 2 }, { id: 'ing_huevo', qty: 1 }, { id: 'ing_pollo', qty: 1 }] },

  // Page 3: Bebidas, Jarras, Infusiones y Frappes
  { id: 'm24', name: 'Inka Cola 600ml', cat: 'Bebidas y Frappes', station: 'BARRA', price: 5.00, desc: 'Botella personal 600 ml.', recipe: [{ id: 'ing_gaseosa', qty: 1 }] },
  { id: 'm25', name: 'Coca Cola 600ml', cat: 'Bebidas y Frappes', station: 'BARRA', price: 5.00, desc: 'Botella personal 600 ml.', recipe: [{ id: 'ing_gaseosa', qty: 1 }] },
  { id: 'm26', name: 'Fanta / Sprite 600ml', cat: 'Bebidas y Frappes', station: 'BARRA', price: 5.00, desc: 'Botella personal 600 ml (indicar sabor en nota).', recipe: [{ id: 'ing_gaseosa', qty: 1 }] },
  { id: 'm27', name: 'Agua Botella', cat: 'Bebidas y Frappes', station: 'BARRA', price: 3.00, desc: 'Agua sin gas botella personal.', recipe: [{ id: 'ing_gaseosa', qty: 1 }] },
  { id: 'm28', name: 'Jarra 1L (Maracuyá / Limonada / Chicha)', cat: 'Bebidas y Frappes', station: 'BARRA', price: 12.00, desc: 'Jarra 1 litro (Maracuyá, Limonada, Emoliente, Linaza o Chicha).', recipe: [{ id: 'ing_pulpa', qty: 1 }] },
  { id: 'm29', name: 'Infusión (Maracuyá / Mango / Cherry / Emoliente)', cat: 'Bebidas y Frappes', station: 'BARRA', price: 7.00, desc: 'Infusión artesanal caliente o fría.', recipe: [{ id: 'ing_pulpa', qty: 1 }] },
  { id: 'm30', name: 'Frappe (Oreo / Fresa / Café)', cat: 'Bebidas y Frappes', station: 'BARRA', price: 17.00, desc: 'Frappe cremoso preparado al momento.', recipe: [{ id: 'ing_pulpa', qty: 1 }] },

  { id: 'm42', retired: true, name: 'Chicha Frost', cat: 'Bebidas y Frappes', station: 'BARRA', price: 8.00, desc: 'Bebida helada de chicha.', recipe: [{ id: 'ing_pulpa', qty: 1 }] },
  { id: 'm43', retired: true, name: 'Limonada Frost', cat: 'Bebidas y Frappes', station: 'BARRA', price: 8.00, desc: 'Bebida helada de limón.', recipe: [{ id: 'ing_pulpa', qty: 1 }] },

  { id: 'm44', name: 'Frost', cat: 'Bebidas y Frappes', station: 'BARRA', price: 8.00, desc: 'Elige chicha o limonada.', recipe: [{ id: 'ing_pulpa', qty: 1 }] },

  // Page 5: Cocteles (Barra)
  { id: 'm31', name: 'The Brothers (Especialidad)', cat: 'Cocteles (Barra)', station: 'BARRA', price: 25.00, desc: 'Especialidad de la casa, leche condensada y pulpa de maracuyá.', recipe: [{ id: 'ing_pisco', qty: 2 }, { id: 'ing_pulpa', qty: 1 }] },
  { id: 'm32', name: 'Piña Colada', cat: 'Cocteles (Barra)', station: 'BARRA', price: 18.00, desc: 'Ron blanco, rodajas de piña, crema de coco y leche.', recipe: [{ id: 'ing_ron', qty: 2 }] },
  { id: 'm33', name: 'Mojito Clásico / Maracuyá', cat: 'Cocteles (Barra)', station: 'BARRA', price: 17.90, desc: 'Ron blanco, azúcar, hierba buena, ginger ale y limón.', recipe: [{ id: 'ing_ron', qty: 2 }] },
  { id: 'm34', name: 'Mojito de Jagger', cat: 'Cocteles (Barra)', station: 'BARRA', price: 25.00, desc: 'Jägermeister, hierba buena y zumo de limón.', recipe: [{ id: 'ing_ron', qty: 2 }] },
  { id: 'm35', name: 'Chilcano Clásico / Maracuyá', cat: 'Cocteles (Barra)', station: 'BARRA', price: 17.00, desc: 'Pisco, zumo de limón, ginger ale y jarabe de goma.', recipe: [{ id: 'ing_pisco', qty: 2 }] },
  { id: 'm36', name: 'Pantera Rosa', cat: 'Cocteles (Barra)', station: 'BARRA', price: 17.00, desc: 'Pisco, jarabe de granadina, leche y crema de coco.', recipe: [{ id: 'ing_pisco', qty: 2 }] },
  { id: 'm37', name: 'Pisco Sour', cat: 'Cocteles (Barra)', station: 'BARRA', price: 19.00, desc: 'Pisco, jarabe de goma, limón, clara de huevo y amargo de angostura.', recipe: [{ id: 'ing_pisco', qty: 2 }] },
  { id: 'm38', name: 'Cuba Libre', cat: 'Cocteles (Barra)', station: 'BARRA', price: 19.00, desc: 'Ron rubio, gaseosa negra y zumo de limón.', recipe: [{ id: 'ing_ron', qty: 2 }] },
  { id: 'm39', name: 'Tequila Sunrise', cat: 'Cocteles (Barra)', station: 'BARRA', price: 19.00, desc: 'Tequila, jugo de naranja y jarabe de granadina.', recipe: [{ id: 'ing_pisco', qty: 2 }] },
  { id: 'm40', name: 'Algarrobina', cat: 'Cocteles (Barra)', station: 'BARRA', price: 19.00, desc: 'Algarrobina, pisco y leche.', recipe: [{ id: 'ing_pisco', qty: 2 }] },
  { id: 'm41', name: 'Ruleta Shot', cat: 'Cocteles (Barra)', station: 'BARRA', price: 85.00, desc: 'Tequila, ron, Jägermeister, vodka, pisco, gin, whisky y gaseosa.', recipe: [{ id: 'ing_pisco', qty: 4 }, { id: 'ing_ron', qty: 4 }] }
];

