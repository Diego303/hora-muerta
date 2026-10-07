// Textos de los casos de incendio (docs/MODOS.md 2.5): una causa por sala, el título
// "{Lugar} en llamas" y una presentación que nombra el foco. Puros: el generador los
// escribe en el banco y el validador comprueba el título.
import type { MapDef, MapId, RoomId } from '../../engine/types';

/** Causa del incendio según la sala del foco, ya con la sala nombrada. */
export const FIRE_CAUSES: Record<MapId, Record<RoomId, string>> = {
  mansion: {
    bib: 'una vela olvidada en la Biblioteca',
    est: 'una lámpara de aceite volcada en el Estudio',
    inv: 'una estufa de queroseno en el Invernadero',
    sal: 'una chispa de la chimenea del Salón',
    ves: 'un brasero mal apagado en el Vestíbulo',
    com: 'un candelabro caído sobre el mantel del Comedor',
    bod: 'una garrafa de alcohol junto a un farol en la Bodega',
    coc: 'una sartén de aceite en la Cocina',
  },
  tren: {
    mir: 'un cigarro mal apagado en el Mirador',
    bar: 'una botella de licor sobre la estufa del Vagón bar',
    res: 'un hornillo de mesa en el Restaurante',
    coc: 'un fogón de carbón en la Cocina',
    cma: 'un cortocircuito en el Coche A',
    cmb: 'una lámpara de gas en el Coche B',
    equ: 'una caja de bengalas en el Furgón',
    cmc: 'un calefactor averiado en el Coche C',
  },
  museo: {
    egi: 'un foco recalentado en la Sala Egipcia',
    nor: 'un cortocircuito en la Galería Norte',
    map: 'una lámpara de lectura en la Sala de Mapas',
    pin: 'un bote de barniz junto a un radiador de la Pinacoteca',
    pat: 'una antorcha de la gala en el Patio',
    esc: 'un soplete de restauración en la Sala de Esculturas',
    rec: 'una estufa eléctrica en la Recepción',
    tie: 'un enchufe sobrecargado en la Tienda',
    arc: 'un cortocircuito en el Archivo',
  },
  hotel: {
    h101: 'un cigarrillo en la cama de la Habitación 101',
    h102: 'una plancha encendida en la Habitación 102',
    h103: 'una vela aromática en la Habitación 103',
    rel: 'un cuadro eléctrico del Rellano',
    esc: 'una papelera ardiendo en la Escalera',
    rec: 'un calefactor bajo el mostrador de la Recepción',
    bar: 'un flambeado que se fue de las manos en el Bar',
    te: 'un hornillo de alcohol en el Salón de té',
  },
  barco: {
    pue: 'un cortocircuito en el Puente de mando',
    pas: 'una tumbona prendida por un farol en la Cubierta de paseo',
    bib: 'una lámpara de mesa en la Biblioteca',
    epr: 'un bidón de aceite en la Proa',
    com: 'un calientaplatos en el Gran comedor',
    epo: 'una bengala de socorro en la Popa',
    cam: 'una estufa de alcohol en los Camarotes',
    maq: 'una fuga de combustible en la Sala de máquinas',
    bod: 'una carga mal estibada en la Bodega',
  },
  teatro: {
    tra: 'un foco caído sobre los telones de la Tramoya',
    esc: 'una pirotecnia mal calculada en el Escenario',
    alm: 'unos decorados recién barnizados en el Almacén',
    pla: 'un cigarro entre las butacas de la Platea',
    cam: 'una bombilla junto a un vestuario en los Camerinos',
    foy: 'una lámpara de araña en el Foyer',
    pal: 'una vela encendida en el Palco',
    amb: 'una cafetera eléctrica en el Ambigú',
  },
};

const CLOSINGS = [
  'Los bomberos te dan cinco minutos dentro antes de que ceda la estructura.',
  'Cinco minutos para dar con el culpable entre el humo.',
  'Tienes cinco minutos antes de que todo se venga abajo.',
];

export function fireTitle(map: MapDef): string {
  return `${map.name} en llamas`;
}

/** Presentación del caso: la causa (que nombra el foco), el lugar y una frase de cierre. */
export function fireIntro(map: MapDef, origin: number, variant: number): string {
  const room = map.rooms[origin];
  const cause = FIRE_CAUSES[map.id]?.[room.id] ?? `un incendio en ${room.art} ${room.name}`;
  const closing = CLOSINGS[((variant % CLOSINGS.length) + CLOSINGS.length) % CLOSINGS.length];
  return `${cause.charAt(0).toUpperCase()}${cause.slice(1)} ha incendiado ${map.place}. ${closing}`;
}
