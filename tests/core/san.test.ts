import { localizeSan } from '../../src/core/san';

it.each([
  ['Nxe5', 'Cxe5'], ['Qh5', 'Dh5'], ['Rxa1', 'Txa1'], ['Kf1', 'Rf1'], ['Bb5', 'Bb5'],
  ['O-O', 'O-O'], ['O-O-O+', 'O-O-O+'], ['e8=Q+', 'e8=D+'], ['exd5', 'exd5'], ['Nbd7', 'Cbd7'],
])('%s → %s', (a, b) => expect(localizeSan(a)).toBe(b));
