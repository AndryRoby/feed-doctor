/* Prihlási sa, že JavaScript beží, a až vtedy sa smie obsah skrývať kvôli príchodom.
 * Musí to byť samostatný súbor, nie vložený skript: naše stránky majú prísne CSP,
 * ktoré vložené skripty blokuje, a bez tohto by sa trieda nepridala vôbec.
 * Načítava sa v hlavičke BEZ defer, aby sa stihla pred vykreslením a obsah neblikol. */
document.documentElement.classList.add('js');
