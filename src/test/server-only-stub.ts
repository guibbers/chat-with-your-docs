/**
 * Substituto de `server-only` nos testes.
 *
 * O pacote real existe para explodir quando um Client Component importa um
 * módulo de servidor. Sob o Vitest (Node puro, sem a condição `react-server`)
 * ele lançaria por engano, derrubando o teste de qualquer módulo que se protege
 * com ele. O alias está em vitest.config.mts.
 */
export {};
