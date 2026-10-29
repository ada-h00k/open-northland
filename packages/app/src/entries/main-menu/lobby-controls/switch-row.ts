/** A settings row of a label and an on/off pill, as the lobby's boolean rules draw it. */
export function switchRow(text: string, toggle: () => void) {
  const row = document.createElement('div');
  row.className = 'main-menu__lobby-option-row';
  const label = document.createElement('span');
  label.textContent = text;
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'main-menu__toggle';
  pill.setAttribute('role', 'switch');
  pill.setAttribute('aria-label', text);
  pill.addEventListener('click', toggle);
  row.append(label, pill);
  return {
    row,
    label,
    pill,
    paint(on: boolean, disabled: boolean): void {
      pill.disabled = disabled;
      pill.classList.toggle('is-on', on);
      pill.setAttribute('aria-checked', String(on));
    },
  };
}
