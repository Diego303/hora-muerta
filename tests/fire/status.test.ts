import { describe, expect, it } from 'vitest';
import { MANSION } from '../../src/engine/content/maps';
import { clockText, fireStatusText, joinRooms, roomIgnitedText } from '../../src/modes/fire/status';
import { photoCheck, previewHeat } from '../../src/modes/fire/timeline';
import { photosText } from '../../src/modes/fire/ui/clues';

// Casa Valdemar con foco en la Cocina (sala 7) y escena en la Biblioteca (sala 0).
const IGN = [240, 180, 135, 180, 135, 90, 180, 45];

describe('reloj', () => {
  it('m:ss redondeando hacia arriba y sin bajar de 0:00', () => {
    expect(clockText(300)).toBe('5:00');
    expect(clockText(59.2)).toBe('1:00');
    expect(clockText(0.4)).toBe('0:01');
    expect(clockText(0)).toBe('0:00');
    expect(clockText(-5)).toBe('0:00');
  });
});

describe('línea de estado (MODOS 2.6): "Arden: X. Después: Y, dentro de 0:20"', () => {
  it('durante el humo dice qué prende primero', () => {
    expect(fireStatusText(MANSION.rooms, IGN, 10)).toBe('Humo. Prende la Cocina, dentro de 0:35.');
  });

  it('con fuego dice qué arde y qué viene después', () => {
    expect(fireStatusText(MANSION.rooms, IGN, 70)).toBe('Arden: la Cocina. Después: el Comedor, dentro de 0:20.');
  });

  it('junta varias salas que prenden a la vez', () => {
    expect(fireStatusText(MANSION.rooms, IGN, 100)).toBe('Arden: el Comedor y la Cocina. Después: el Invernadero y el Vestíbulo, dentro de 0:35.');
  });

  it('cuando ya arde todo, solo dice qué arde', () => {
    expect(fireStatusText(MANSION.rooms, IGN, 250)).toBe(
      'Arden: la Biblioteca, el Estudio, el Invernadero, el Salón, el Vestíbulo, el Comedor, la Bodega y la Cocina.',
    );
  });

  it('nombres con artículo y "y" final', () => {
    expect(joinRooms([MANSION.rooms[0]])).toBe('la Biblioteca');
    expect(joinRooms([])).toBe('');
    expect(roomIgnitedText(MANSION.rooms[7])).toBe('La Cocina arde.');
  });
});

describe('fotos (MODOS 2.2 y 2.9)', () => {
  it('se puede salvar una pista que aún no arde si quedan fotos', () => {
    expect(photoCheck('ok', 2)).toBe('ok');
    expect(photoCheck('heat', 1)).toBe('ok');
  });

  it('una pista que ya arde se rechaza aunque queden fotos', () => {
    expect(photoCheck('burning', 2)).toBe('too-late');
    expect(photoCheck('burnt', 2)).toBe('too-late');
  });

  it('sin fotos no se salva nada, y una salvada no gasta otra', () => {
    expect(photoCheck('ok', 0)).toBe('no-photos');
    expect(photoCheck('saved', 1)).toBe('already-saved');
  });

  it('contador de fotos', () => {
    expect(photosText(2)).toBe('2 fotos para salvar pistas');
    expect(photosText(1)).toBe('1 foto para salvar una pista');
    expect(photosText(0)).toBe('Sin fotos: ya no puedes salvar más pistas');
  });
});

describe('vista previa de calor de la sala del incendio', () => {
  it('máximo en el foco, menos a cada puerta, nada a 4 puertas o más ni sin camino', () => {
    const heat = previewHeat([0, 1, 2, 3, 4, -1]);
    expect(heat[0]).toBeCloseTo(0.8);
    expect(heat[1]).toBeCloseTo(0.592);
    expect(heat[3]).toBeCloseTo(0.176);
    expect(heat[4]).toBe(0);
    expect(heat[5]).toBe(0);
  });
});
