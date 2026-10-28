import dayjs from "dayjs"
import utc from "dayjs/plugin/utc.js"
import timezone from "dayjs/plugin/timezone.js"
import isLeapYear from "dayjs/plugin/isLeapYear.js"
import isoWeeksInYear from "dayjs/plugin/isoWeeksInYear.js"
import advancedFormat from "dayjs/plugin/advancedFormat.js"
import arraySupport from "dayjs/plugin/arraySupport.js"
import bigIntSupport from "dayjs/plugin/bigIntSupport.js"
import buddhistEra from "dayjs/plugin/buddhistEra.js"
import calendar from "dayjs/plugin/calendar.js"
import customParseFormat from "dayjs/plugin/customParseFormat.js"
import dayOfYear from "dayjs/plugin/dayOfYear.js"
import duration from "dayjs/plugin/duration.js"
import isBetween from "dayjs/plugin/isBetween.js"
import isMoment from "dayjs/plugin/isMoment.js"
import isoWeek from "dayjs/plugin/isoWeek.js"
import isSameOrAfter from "dayjs/plugin/isSameOrAfter.js"
import isSameOrBefore from "dayjs/plugin/isSameOrBefore.js"
import isToday from "dayjs/plugin/isToday.js"
import isTomorrow from "dayjs/plugin/isTomorrow.js"
import isYesterday from "dayjs/plugin/isYesterday.js"
import localeData from "dayjs/plugin/localeData.js"
import localizedFormat from "dayjs/plugin/localizedFormat.js"
import minMax from "dayjs/plugin/minMax.js"
import negativeYear from "dayjs/plugin/negativeYear.js"
import objectSupport from "dayjs/plugin/objectSupport.js"
import pluralGetSet from "dayjs/plugin/pluralGetSet.js"
import preParsePostFormat from "dayjs/plugin/preParsePostFormat.js"
import quarterOfYear from "dayjs/plugin/quarterOfYear.js"
import relativeTime from "dayjs/plugin/relativeTime.js"
import toArray from "dayjs/plugin/toArray.js"
import toObject from "dayjs/plugin/toObject.js"
import updateLocale from "dayjs/plugin/updateLocale.js"
import weekday from "dayjs/plugin/weekday.js"
import weekOfYear from "dayjs/plugin/weekOfYear.js"
import weekYear from "dayjs/plugin/weekYear.js"

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isLeapYear)
dayjs.extend(isoWeeksInYear)
dayjs.extend(advancedFormat)
dayjs.extend(arraySupport)
dayjs.extend(bigIntSupport)
dayjs.extend(buddhistEra)
dayjs.extend(calendar)
dayjs.extend(customParseFormat)
dayjs.extend(dayOfYear)
dayjs.extend(duration)
dayjs.extend(isBetween)
dayjs.extend(isMoment)
dayjs.extend(isoWeek)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(isToday)
dayjs.extend(isTomorrow)
dayjs.extend(isYesterday)
dayjs.extend(localeData)
dayjs.extend(localizedFormat)
dayjs.extend(minMax)
dayjs.extend(negativeYear)
dayjs.extend(objectSupport)
dayjs.extend(pluralGetSet)
dayjs.extend(preParsePostFormat)
dayjs.extend(quarterOfYear)
dayjs.extend(relativeTime)
dayjs.extend(toArray)
dayjs.extend(toObject)
dayjs.extend(updateLocale)
dayjs.extend(weekday)
dayjs.extend(weekOfYear)
dayjs.extend(weekYear)

export default dayjs
