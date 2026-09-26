// Sample data. Replace it with yours.
//
// If the data changes over time, don't hand-edit it here: write a script that
// fetches it at build time into public/data/ (gitignored) and add a schedule
// trigger to the deploy workflow. If the data doesn't exist anywhere yet and
// has to be researched, the dataviz-pages-site skill has a reference for that.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SERIES = [
  { id: 'coffee', label: 'Coffee', values: [42, 45, 51, 48, 55, 61, 64, 62, 70, 74, 71, 78] },
  { id: 'tea', label: 'Tea', values: [30, 28, 33, 35, 34, 38, 41, 39, 44, 46, 49, 47] },
  { id: 'water', label: 'Water', values: [60, 58, 62, 66, 71, 80, 88, 91, 84, 76, 68, 63] },
]
