// The words in the GTA method popover (GtaMethod.jsx). No records in the
// fixed text: the sum line reads them from the table, so it stays right
// after every game.
export const COPY = {
  button: 'How we count',
  heading: 'How soon is right after?',
  intro: (team) => `${team}'s next game after each Grand Theft Auto release.`,
  colRelease: 'Release',
  colGame: () => 'Next game',
  colDays: 'Days',
  colCounts: 'Counts?',
  yes: 'Yes',
  no: 'No',
  toPlay: 'to play',
  sum: (team, loose, ours) => `Next game, however late: ${loose}. Release week only: ${ours}.`,
  why: 'A season opener nine months later comes right after fall camp. We count the seven days starting on release day, and a team that didn’t play that week skips that release.',
};
