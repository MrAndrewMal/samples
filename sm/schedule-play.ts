import { weekdays } from 'src/constants';
import * as Types from 'src/types/main';
import time from 'src/utils/time';
import {
  getEverydayScheduleFromLocalDB,
  getWeekdayScheduleFromLocalDB,
  getEventsScheduleFromLocalDB,
} from 'src/utils/local-db';

const TIMESLOT_TYPE_PRIORITY_ORDER = ['EVENTS', 'DATE', 'WEEKDAY', 'DAY'];

export type GetScheduleContentParams = {
  locationId: string | null;
};

export async function getContent(params: GetScheduleContentParams): Promise<Types.TimeslotType | null> {
  const { locationId } = params;
  const todayWeekday = weekdays.get(time().isoWeekday())! as keyof Types.ScheduleType;
  const weekdaySchedule = getWeekdayScheduleFromLocalDB();
  const eventsSchedule = getEventsScheduleFromLocalDB();
  const dayTimeslot: Types.TimeslotType[] = weekdaySchedule ? weekdaySchedule[todayWeekday] || [] : [];
  const everydayTimeslot: Types.TimeslotType[] = getEverydayScheduleFromLocalDB() || [];
  const currentTime = time();
  const { timezoneDevice } = window;
  const dayContent = ([...dayTimeslot, ...everydayTimeslot, ...eventsSchedule] || []).filter((timeslot) => {
    const tss = time(timeslot.start).local();
    const timeslotStartHour = tss.hour();
    const timeslotStartMinute = tss.minute();
    const timeslotStart = currentTime.clone().hour(timeslotStartHour).minute(timeslotStartMinute).second(0);
    const tse = time(timeslot.end).local();
    const timeslotEndHour = tse.hour();
    const timeslotEndMinute = tse.minute();
    const timeslotEnd = currentTime.clone().hour(timeslotEndHour).minute(timeslotEndMinute).second(0);
    return currentTime.isBetween(timeslotStart, timeslotEnd);
  });
  // logger('getContent', { dayContent, everydayTimeslot });
  if (!!dayContent && dayContent.length > 0) {
    const content = TIMESLOT_TYPE_PRIORITY_ORDER.reduce((result, periodType) => {
      if (!locationId && periodType === 'EVENTS') {
        return result;
      }
      if (result) {
        return result;
      }
      return dayContent.find((f) => f.type === periodType);
    }, null)!;

    return content;
  }
  return null;
}
//
