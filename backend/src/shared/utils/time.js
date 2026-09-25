const MS_PER_HOUR = 60 * 60 * 1000

/** Hours elapsed from `from` to `to`; negative when `to` is earlier. */
function hoursBetween(from, to) {
  return (new Date(to).getTime() - new Date(from).getTime()) / MS_PER_HOUR
}

module.exports = { MS_PER_HOUR, hoursBetween }
