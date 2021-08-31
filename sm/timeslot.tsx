import React, { memo, useMemo, useEffect, useState, useCallback, useLayoutEffect, useContext } from 'react';
import * as Types from 'src/types/main';
import logger from 'src/utils/logger';
import orderBy from 'lodash/orderBy';
import { getNextItem } from 'src/utils/carousel-item';
//
import { MediaItemComponent } from './media-item';
import { TemplateComponent } from './template';
import { PlaylistComponent } from './playlist';
export interface TimeslotComponentProps {
  data: Types.TimeslotType;
  loopVideo?: boolean;
  fullscreen?: boolean;
  style?: { [key: string]: string };
}

export const DEFAULT_TIMESLOT_ITEM_DURATION = 60000;
export const MIN_TIMESLOT_ITEM_DURATION = 3000;

export const TimeslotComponent: React.FC<TimeslotComponentProps> = memo((props) => {
  //
  const { data } = props;
  const [activeItem, setActiveItem] = useState<Types.TimeslotItemType>();
  //
  logger('TimeslotComponent', data);
  const timeslotItems = data?.items || [];

  const listMedia = useMemo(() => orderBy(timeslotItems, 'sequence', 'asc'), [timeslotItems]);
  const isLoop = listMedia.length === 1;
  //
  const onPlaybackEnd = useCallback(() => {
    setActiveItem(getNextItem<Types.TimeslotItemType>(listMedia, activeItem));
  }, [listMedia, activeItem]);
  //
  const content = useMemo(() => {
    if (activeItem?.template) {
      return <TemplateComponent data={activeItem?.template} />;
    }
    if (activeItem?.playlist) {
      return <PlaylistComponent data={activeItem?.playlist} onPlaybackEnd={onPlaybackEnd} />;
    }
    if (activeItem?.mediaItem) {
      return (
        <MediaItemComponent data={activeItem?.mediaItem} loopVideo={isLoop} onPlaybackEnd={onPlaybackEnd} />
      );
    }
    //
    return null;
  }, [activeItem, onPlaybackEnd]);

  // For handling duration and changing of templates and media-items with type 'IMAGE'
  useLayoutEffect(() => {
    if (listMedia?.length === 0) {
      return () => {};
    }
    if (!activeItem) {
      setActiveItem(listMedia[0]);
      return () => {};
    }
    // !This useEffect must NOT handle video and playlists because their rotation must be handled by 'onPlaybackEnd' callback
    if (activeItem.mediaItem?.type === 'video' || activeItem?.playlist) {
      return () => {};
    }
    //
    const timeoutId = setTimeout(() => {
      setActiveItem(getNextItem<Types.TimeslotItemType>(listMedia, activeItem));
    }, Math.max(activeItem.duration * 1000 || DEFAULT_TIMESLOT_ITEM_DURATION, MIN_TIMESLOT_ITEM_DURATION));
    //
    return () => clearTimeout(timeoutId);
  }, [listMedia, activeItem, setActiveItem]);
  //
  useEffect(() => {
    setActiveItem(listMedia[0]);
  }, [data]);
  //
  logger('Content in Timeslot component', { activeItem });
  //
  return content;
});
TimeslotComponent.displayName = 'TimeslotComponent';
TimeslotComponent.propTypes = {};
TimeslotComponent.defaultProps = {};

export default TimeslotComponent;
