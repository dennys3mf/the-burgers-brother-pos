// Coordinates use the same 559 × 790 canvas for all five pages of the printed menu.
const column = (left, right, rows) => rows.map(([id, top, bottom]) => ({ id, left, right, top, bottom }));

export const menuPages = [
  {
    title: 'Hamburguesas',
    spots: column(25, 303, [
      ['m1', 51, 155], ['m2', 157, 264], ['m3', 268, 371],
      ['m4', 373, 478], ['m5', 479, 598], ['m6', 599, 722]
    ])
  },
  {
    title: 'Alitas y combos',
    spots: [
      ...column(15, 241, [
        ['m7', 31, 156], ['m8', 159, 250], ['m9', 252, 358],
        ['m10', 366, 476], ['m11', 489, 598], ['m12', 600, 732]
      ]),
      ...column(280, 551, [
        ['m13', 181, 294], ['m14', 295, 405], ['m15', 417, 506], ['m16', 507, 616]
      ])
    ]
  },
  {
    title: 'Bebidas',
    spots: [
      ...column(20, 181, [
        ['m24', 101, 123], ['m25', 124, 146], ['m26', 147, 193],
        ['m28', 232, 412], ['m29', 431, 614]
      ]),
      ...column(309, 385, [['m27', 346, 383]]),
      ...column(304, 432, [['m30', 475, 586]]),
      { id: 'm44', left: 294, right: 444, top: 601, bottom: 686, showPrice: true }
    ]
  },
  {
    title: 'Salchipapas y broster',
    spots: column(19, 366, [
      ['m17', 121, 190], ['m18', 195, 271], ['m19', 273, 345],
      ['m20', 360, 447], ['m21', 458, 535], ['m22', 548, 617], ['m23', 628, 724]
    ])
  },
  {
    title: 'Cócteles',
    spots: column(17, 369, [
      ['m31', 54, 125], ['m32', 126, 177], ['m33', 178, 250],
      ['m34', 251, 316], ['m35', 319, 366], ['m36', 369, 420],
      ['m37', 421, 485], ['m38', 488, 542], ['m39', 543, 586],
      ['m40', 589, 635], ['m41', 636, 714]
    ])
  }
];

export const drinkOptions = {
  m26: ['Fanta', 'Sprite'],
  m28: ['Maracuyá', 'Limonada', 'Emoliente', 'Linaza', 'Chicha'],
  m29: ['Maracuyá', 'Mango', 'Cherry', 'Caramelo', 'Emoliente', 'Linaza'],
  m30: ['Oreo', 'Fresa', 'Café'],
  m44: ['Chicha', 'Limonada']
};
