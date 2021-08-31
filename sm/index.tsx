// import '@formatjs/intl-locale/polyfill';
// import 'date-time-format-timezone';
import React, { useEffect, useState, useMemo, useCallback, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/react';
//@ts-ignore
import { NavigationProvider } from 'react-keyboard-navigation';
// import { ApolloProvider, browserClient } from '@fjedi/graphql-react-components';
//
import Screen from 'src/utils/screen';
import time, { formatDate } from 'src/utils/time';
import logger from 'src/utils/logger';
import { getContent } from 'src/utils/schedule-play';
import {
  getSettingsFromLocalDB,
  updateSettingsInLocalDB,
  updateEverydayScheduleInLocalDB,
  updateMediaFilesInLocalDB,
  updateDefaultMediaInLocalDB,
} from 'src/utils/local-db';
//
import TizenDevice from 'src/tizen/device';
import Web0sDevice from 'src/webos/device';
import RaspberryDevice from 'src/raspberry/device';
import ChromiumDevice from 'src/chrome/device';
import Device from 'src/class/control-device';
import * as Types from 'src/types/main';
//
import useInterval from './hooks/use-interval';
// Import module for working with local-db
// import { ImmortalStorage, CookieStore, LocalStorageStore } from 'immortal-db';
//
import io, { Socket } from 'socket.io-client';
//
import {
  ActiveTimeslotContext,
  RawScheduleContext,
  WebsocketContext,
  DeviceContext,
  SettingsContext,
} from './context';
import useFetch from './hooks/use-fetch';

// Components
import Registration from './routes/registration';
import App from './routes/app';
import DeviceNameContainer from './components/device-name';
import DisplayText from './components/display-text';
import DebuggerComponent from './components/debugger';
// Styles
import './style/main.css';

//
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENV,
  // None = 0, // No logs will be generated
  // Error = 1, // Only SDK internal errors will be logged
  // Debug = 2, // Information useful for debugging the SDK will be logged
  // Verbose = 3 // All SDK actions will be logged
  logLevel: process.env.RUNTIME_ENV === 'production' ? 2 : 3,
});
window.packageVersion = '[AIV]{version}[/AIV]';
window.needReload = false;
//
const timezoneDevice = time.tz.guess();
window.timezoneDevice = timezoneDevice;
//
window.hostname = process.env.API_HOST || 'localhost';
// Init ImmortalDB
// const stores = [CookieStore, LocalStorageStore];
// const db = new ImmortalStorage(stores);

// Init block
// const display = new Display();
const screen = new Screen();

const params = new URLSearchParams(window.location.href);
const customWidth = params.get('width');
const customHeight = params.get('height');
// window.resizeTo(parseInt(customWidth, 10), parseInt(customHeight, 10));
window.screenHeight = customHeight || window.screen.height;
window.screenWidth = customWidth || window.screen.width;
const { screenHeight, screenWidth } = window;
window.ratio = screen.calculateRation(screenWidth, screenHeight);
logger('ratio', { screenHeight, screenWidth });
//
// window.debug = false;
// Backward compatibility for LocalStorage from Immortal-DB
const tokenImmortal = window.localStorage.getItem('_immortal|token');
const tokenLocalStorage = window.localStorage.getItem('token');
if (tokenImmortal && typeof tokenImmortal === 'string' && !tokenLocalStorage) {
  window.localStorage.setItem('token', tokenImmortal);
  window.localStorage.removeItem('_immortal|token');
}
//
// Create the 'root' entry point into the app.  If we have React hot loading
// (i.e. if we're in development), then we'll wrap the whole thing in an
// <AppContainer>.  Otherwise, we'll jump straight to the browser router
async function doRender() {
  // await loadPolyfills(['intl', 'fetch']);
  // @ts-ignore
  ReactDOM[module.hot ? 'render' : 'hydrate'](
    <Sentry.ErrorBoundary
      beforeCapture={(scope) => {
        scope.setTag('packageVersion', window.packageVersion);
      }}
      fallback={({ error, componentStack, resetError }) => (
        <>
          <DisplayText center>You have encountered a fatal error, please reload your device</DisplayText>
          {/* <div>{error.toString()}</div>
          <div>{componentStack}</div>
          <button onClick={window.location.reload}>Click here to reload page</button> */}
        </>
      )}
    >
      <Root />
    </Sentry.ErrorBoundary>,
    //
    document.getElementById('root'),
  );
}
// The <Root> component.  We'll run this as a self-contained function since
// we're using a bunch of temporary vars that we can safely discard.
//
// If we have hot reloading enabled (i.e. if we're in development), then
// we'll wrap the whole thing in <AppContainer> so that our views can respond
// to code changes as needed
const Root = (() => {
  // Wrap the component hierarchy in <BrowserRouter>, so that our children
  // can respond to route changes
  const Chain = () => {
    const [token, setToken] = useState<string | null>(null);
    const [websocketConnection, setSocketConnection] = useState<typeof Socket | null>(null);
    const [settings, setSettings] = useState<Types.SettingsType | null>(null);
    const { locationId = null } = settings || {};
    const [isStarting, setStarting] = useState<boolean>(false);
    const [activeTimeslot, setActiveTimeslot] = useState<Types.TimeslotType | null>(null);
    const clearData = useCallback(() => {
      logger('Run function clearData');
      //
      updateEverydayScheduleInLocalDB(null);
      updateDefaultMediaInLocalDB(null);
      updateMediaFilesInLocalDB([]);
      updateSettingsInLocalDB(null);
      // db.remove('token').catch(logger);
      window.localStorage.removeItem('token');
      setToken(null);
      store?.purge(); //! TIZEN
      player?.stopVideo();
      setActiveTimeslot(null);
    }, [setToken]);
    //
    const headers = useMemo(
      () => ({
        'Content-Type': 'application/json',
        Authorization: token,
      }),
      [token],
    );
    const url = new URL(`${process.env.REST_URL}?weekNumber=${time().isoWeek()}`);
    logger('Fetching content from remote api...', { url, href: url.href });
    const { status, data, error, refetch } = useFetch<Types.DataType>(url.href, {
      headers,
      method: 'GET',
      skip: !token,
    });
    logger('Got response', {
      status,
      data,
      error,
      token,
    });
    //
    useEffect(() => {
      //
      if (
        status === 'error' &&
        // @ts-ignore
        error?.response?.status === 403
      ) {
        logger('Response 403!!!');
        Sentry.captureException(error);
        Sentry.withScope(function (scope) {
          scope.setTag('packageVersion', window.packageVersion);
          scope.setTag('token', token);
          scope.setTag('RegCode', window.localStorage.getItem('code'));
          scope.setTag('DeviceID', window.localStorage.getItem('deviceId'));
          scope.setLevel(Sentry.Severity.Info);
          Sentry.captureException('info');
        });
        clearData();
      }
      if (status === 'error' && !error?.response) {
        device.store.progress = 100;
        if (typeof device?.store?.listener?.dispatchEvent === 'function') {
          device?.store.listener.dispatchEvent(new CustomEvent('file-load', { detail: { percent: 100 } }));
          logger('error progress:', device.store.progress);
        }
        device?.startSchedule();
        logger('Network error, start local schedule');
      }
    }, [status, clearData, token, setStarting]);
    //
    useLayoutEffect(() => {
      setToken(window.localStorage.getItem('token'));
    }, [setToken]);
    //
    useEffect(() => {
      setSettings(getSettingsFromLocalDB());
    }, [setSettings]);
    //
    useEffect(() => {
      // socket.io connection
      const socket = io(`https://${process.env.API_HOST}`);
      //
      socket.on('connect', async () => {
        logger('socket connected');
        setSocketConnection(socket);
        if (token) {
          socket.emit('authorization', {
            token,
            timezone: timezoneDevice,
            version: window.packageVersion,
          });
          if (window.waitConnect) {
            // await handleSchedule(); //!TODO
            window.waitConnect = false;
          }
        }
      });
      //
      socket.on('disconnect', () => {
        window.waitConnect = true;
        // stateConnection();
        logger('socket disconnected');
        //
        setSocketConnection(null);
      });
      //
      socket.on('error', (error: Error) => {
        logger('error', error);
      });
      //
      socket.on('connect_error', (error: Error) => {
        logger('connect_error', error);
      });
      //
      socket.on('connect_failed', (error: Error) => {
        logger('connect_failed', error);
      });
      //
      socket.on('device-registered', async (msg: { token: string; name: string }) => {
        setSettings(updateSettingsInLocalDB({ deviceName: msg.name }));
        // await db.set('token', msg.token);
        window.localStorage.setItem('token', msg.token);
        setToken(msg.token);
      });
      socket.on('device-reload', async () => {
        device.reload();
      });
      socket.on('device-reboot', async () => {
        device.reboot();
      });
      socket.on('device-removed', async () => {
        if (!token) {
          return;
        }
        clearData();
      });
      socket.on('update-schedule', async () => {
        logger('Updating schedule...');
        refetch().catch(logger);
        setActiveTimeslot(null);
        player?.stopVideo();
        setStarting(false);
      });
      if (device instanceof RaspberryDevice) {
        socket.on('overscan-settings-update', async (msg: Types.SetOverscanType) => {
          device.setOverscan(msg);
        });
        socket.on('wifi-settings-update', async (msg: Types.WifiConfigType) => {
          device.wifiConfig(msg);
        });
      }
      socket.on('device-update', async (deviceInfo: Types.DeviceInfoType) => {
        if (deviceInfo) {
          logger('device-update', { deviceInfo });
          const { name, locationId } = deviceInfo;
          const { orientation, debug, invertVideoRotation } = deviceInfo.props || {};
          //
          if (
            typeof orientation === 'number' &&
            settings?.orientation !== orientation &&
            device.type !== 'web0s'
          ) {
            screen.rotate(orientation);
          }
          setSettings(
            updateSettingsInLocalDB({
              orientation: typeof orientation !== 'undefined' ? orientation : settings?.orientation,
              debug: typeof debug !== 'undefined' ? debug : false,
              deviceName: typeof name !== 'undefined' ? name : settings?.deviceName,
              locationId,
              invertVideoRotation:
                typeof invertVideoRotation !== 'undefined'
                  ? invertVideoRotation
                  : settings?.invertVideoRotation,
            }),
          );
        }
      });
      //
    }, [token, clearData, setActiveTimeslot, websocketConnection?.connected]);
    //
    useInterval(
      () => {
        if (!isStarting) {
          return;
        }
        getContent({ locationId })
          .then((timeslot) => {
            if (timeslot?.id === activeTimeslot?.id) {
              return;
            }
            setActiveTimeslot(timeslot);
          })
          .catch(logger);
      },
      isStarting ? 1000 : null,
    );
    //
    useLayoutEffect(() => {
      if (!isStarting) {
        return;
      }
      logger('getContent');
      getContent({ locationId }).then(setActiveTimeslot).catch(logger);
    }, [isStarting, data, setActiveTimeslot, locationId]);
    const deviceType = Device.getType();
    //
    const deviceProps = {
      deviceType,
      startSchedule: () => {
        setStarting(true);
        logger('StartSchedule call');
      },
      packageVersion: window.packageVersion,
    };
    const device = useMemo(() => {
      switch (deviceType) {
        case 'tizen':
          return new TizenDevice(deviceProps);
        case 'web0s':
          return new Web0sDevice(deviceProps);
        case 'arm':
          return new RaspberryDevice(deviceProps);
        case 'chrome':
          return new ChromiumDevice(deviceProps);
        default:
          // display.textCenter('This device is not supported!');
          throw new Error('Not find device in userAgent');
      }
    }, []) as Device;
    const { store, player } = device;
    screen.rotate(settings?.orientation || 0);
    //
    return (
      <WebsocketContext.Provider value={websocketConnection}>
        <SettingsContext.Provider value={settings}>
          <DeviceContext.Provider value={device}>
            <RawScheduleContext.Provider value={data || null}>
              <ActiveTimeslotContext.Provider value={activeTimeslot}>
                <NavigationProvider>
                  <>
                    {!token && <Registration />}
                    {!!token && (
                      <>
                        <App token={token} isStarting={isStarting} />
                        <DeviceNameContainer />
                        <DebuggerComponent />
                      </>
                    )}
                  </>
                </NavigationProvider>
              </ActiveTimeslotContext.Provider>
            </RawScheduleContext.Provider>
          </DeviceContext.Provider>
        </SettingsContext.Provider>
      </WebsocketContext.Provider>
    );
  };

  return Chain;
})();

doRender();
