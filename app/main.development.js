import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import SysLog from 'electron-log'
import uuid from 'uuid'

import TestRPCService from './Services/TestRPCService'
import ConsoleService from './Services/ConsoleService'
import SettingsService from './Services/SettingsService'

let menu
let template
let mainWindow = null
let testRpcService = null
let consoleService = null // eslint-disable-line

global.Settings = new SettingsService()

// Analytics Tracking Setup
Settings.set('uuid', Settings.get('uuid', uuid.v4())) // eslint-disable-line

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support') // eslint-disable-line
  sourceMapSupport.install()

  SysLog.transports.file.level = 'silly'
  SysLog.transports.console.level = 'silly'
}

if (process.env.NODE_ENV === 'development') {
  require('electron-debug')() // eslint-disable-line global-require
  const path = require('path') // eslint-disable-line
  const p = path.join(__dirname, '..', 'app', 'node_modules') // eslint-disable-line
  require('module').globalPaths.push(p) // eslint-disable-line

  SysLog.transports.file.level = 'silly'
  SysLog.transports.console.level = 'silly'
}

process.on('uncaughtException', err => {
  if (testRpcService && testRpcService.webView) {
    testRpcService.webView.send('APP/FATALERROR', err.stack)
  }

  SysLog.error(`FATAL ERROR: ${err.stack}`)
})

process.on('unhandledRejection', error => {
  SysLog.error('unhandledRejection', error)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// if (process.platform === 'darwin') {
//   app.dock.setIcon(path.resolve(__dirname, '../icons/png/512x512.png'))
// }

const installExtensions = async () => {
  if (process.env.NODE_ENV === 'development') {
    const installer = require('electron-devtools-installer') // eslint-disable-line global-require

    const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS']

    const forceDownload = !!process.env.UPGRADE_EXTENSIONS

    // TODO: Use async interation statement.
    //       Waiting on https://github.com/tc39/proposal-async-iteration
    //       Promises will fail silently, which isn't what we want in development
    Promise.all(
      extensions.map(name => installer.default(installer[name], forceDownload))
    ).catch(console.log)
  }
}

app.setName('GANACHE')

const getIconPath = () => {
  return process.platform === 'win32'
    ? path.resolve(`${__dirname}/../resources/icons/win/icon.ico`)
    : path.resolve(`${__dirname}/../resources/icons/png/256x256.png`)
}

if (process.platform === 'darwin') {
  app.dock.setIcon(getIconPath())
}

app.on('ready', async () => {
  await installExtensions()

  mainWindow = new BrowserWindow({
    show: false,
    minWidth: 1200,
    minHeight: 800,
    width: 1200,
    height: 930,
    frame: false,
    icon: getIconPath()
  })

  mainWindow.loadURL(`file://${__dirname}/app.html`)

  consoleService = new ConsoleService(ipcMain, mainWindow) // eslint-disable-line
  testRpcService = new TestRPCService(ipcMain, mainWindow, consoleService) // eslint-disable-line

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.setTitle('GANACHE')
    autoUpdater.checkForUpdates()
    // mainWindow.send('APP/UPDATENOTAVAILABLE', {})
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    testRpcService = null
    consoleService = null
  })

  // if (process.env.NODE_ENV === 'development') {
  mainWindow.webContents.on('context-menu', (e, props) => {
    const { x, y } = props

    Menu.buildFromTemplate([
      {
        label: 'Inspect element',
        click () {
          mainWindow.inspectElement(x, y)
        }
      }
    ]).popup(mainWindow)
  })
  // }

  autoUpdater.logger = SysLog
  autoUpdater.logger.transports.file.level = 'info'
  autoUpdater.autoDownload = false

  if (process.env.NODE_ENV === 'development') {
    //autoUpdater.updateConfigPath = path.resolve('./app/dev-app-update.yml')
  }

  autoUpdater.on('checking-for-update', () => {
    mainWindow.send('APP/UPDATECHECK', { message: 'Checking for update...' })
  })

  autoUpdater.on('update-available', (ev, info) => {
    console.log(info)
    mainWindow.send('APP/UPDATEAVAILABLE', info)
  })

  autoUpdater.on('update-not-available', (ev, info) => {
    mainWindow.send('APP/UPDATENOTAVAILABLE', info)
  })

  autoUpdater.on('error', (ev, err) => {
    mainWindow.send('APP/UPDATEERROR', err)
  })

  autoUpdater.on('download-progress', (ev, progressObj) => {
    mainWindow.send('APP/UPDATEDOWNLOADPROGRESS', progressObj)
  })

  autoUpdater.on('update-downloaded', (ev, info) => {
    mainWindow.send('APP/UPDATEDOWNLOADED', info)

    setTimeout(() => {
      autoUpdater.quitAndInstall()
    }, 5000)
  })

  if (process.platform === 'darwin') {
    template = [
      {
        label: 'Ganache',
        submenu: [
          {
            label: 'About Ganache ' + app.getVersion(),
            selector: 'orderFrontStandardAboutPanel:'
          },
          {
            type: 'separator'
          },
          {
            label: 'Services',
            submenu: []
          },
          {
            type: 'separator'
          },
          {
            label: 'Hide Ganache',
            accelerator: 'Command+H',
            selector: 'hide:'
          },
          {
            label: 'Hide Others',
            accelerator: 'Command+Shift+H',
            selector: 'hideOtherApplications:'
          },
          {
            label: 'Show All',
            selector: 'unhideAllApplications:'
          },
          {
            type: 'separator'
          },
          {
            label: 'Quit',
            accelerator: 'Command+Q',
            click () {
              app.quit()
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          {
            label: 'Undo',
            accelerator: 'Command+Z',
            selector: 'undo:'
          },
          {
            label: 'Redo',
            accelerator: 'Shift+Command+Z',
            selector: 'redo:'
          },
          {
            type: 'separator'
          },
          {
            label: 'Cut',
            accelerator: 'Command+X',
            selector: 'cut:'
          },
          {
            label: 'Copy',
            accelerator: 'Command+C',
            selector: 'copy:'
          },
          {
            label: 'Paste',
            accelerator: 'Command+V',
            selector: 'paste:'
          },
          {
            label: 'Select All',
            accelerator: 'Command+A',
            selector: 'selectAll:'
          }
        ]
      },
      {
        label: 'View',
        submenu:
          process.env.NODE_ENV === 'development'
            ? [
              {
                label: 'Reload',
                accelerator: 'Command+R',
                click () {
                  mainWindow.webContents.reload()
                }
              },
              {
                label: 'Toggle Full Screen',
                accelerator: 'Ctrl+Command+F',
                click () {
                  mainWindow.setFullScreen(!mainWindow.isFullScreen())
                }
              },
              {
                label: 'Toggle Developer Tools',
                accelerator: 'Alt+Command+I',
                click () {
                  mainWindow.toggleDevTools()
                }
              }
            ]
            : [
              {
                label: 'Toggle Full Screen',
                accelerator: 'Ctrl+Command+F',
                click () {
                  mainWindow.setFullScreen(!mainWindow.isFullScreen())
                }
              }
            ]
      },
      {
        label: 'Window',
        submenu: [
          {
            label: 'Accounts',
            accelerator: 'Command+1',
            selector: 'performAccounts:'
          },
          {
            label: 'Blocks',
            accelerator: 'Command+2',
            selector: 'performBlocks:'
          },
          {
            label: 'Transactions',
            accelerator: 'Command+3',
            selector: 'performTransactions:'
          },
          {
            label: 'Console',
            accelerator: 'Command+4',
            selector: 'performConsole:'
          },
          {
            label: 'Settings',
            accelerator: 'Command+5',
            selector: 'performSettings:'
          },
          {
            label: 'Minimize',
            accelerator: 'Command+M',
            selector: 'performMiniaturize:'
          },
          {
            label: 'Close',
            accelerator: 'Command+W',
            selector: 'performClose:'
          },
          {
            type: 'separator'
          },
          {
            label: 'Bring All to Front',
            selector: 'arrangeInFront:'
          }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Learn More',
            click () {
              shell.openExternal('http://truffleframework.com/suite/ganache')
            }
          },
          {
            label: 'Documentation',
            click () {
              shell.openExternal(
                'https://github.com/trufflesuite/ganache/blob/master/README.md'
              )
            }
          },
          {
            label: 'Community Discussions',
            click () {
              shell.openExternal(
                'https://github.com/trufflesuite/ganache/issues'
              )
            }
          },
          {
            label: 'Search Issues',
            click () {
              shell.openExternal(
                'https://github.com/trufflesuite/ganache/issues'
              )
            }
          }
        ]
      }
    ]

    menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  } else {
    template = [
      {
        label: '&File',
        submenu: [
          {
            label: '&Open',
            accelerator: 'Ctrl+O'
          },
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click () {
              mainWindow.close()
            }
          }
        ]
      },
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development'
            ? [
              {
                label: '&Reload',
                accelerator: 'Ctrl+R',
                click () {
                  mainWindow.webContents.reload()
                }
              },
              {
                label: 'Toggle &Full Screen',
                accelerator: 'F11',
                click () {
                  mainWindow.setFullScreen(!mainWindow.isFullScreen())
                }
              },
              {
                label: 'Toggle &Developer Tools',
                accelerator: 'Alt+Ctrl+I',
                click () {
                  mainWindow.toggleDevTools()
                }
              }
            ]
            : [
              {
                label: 'Toggle &Full Screen',
                accelerator: 'F11',
                click () {
                  mainWindow.setFullScreen(!mainWindow.isFullScreen())
                }
              }
            ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Learn More',
            click () {
              shell.openExternal('http://truffleframework.com/suite/ganache')
            }
          },
          {
            label: 'Documentation',
            click () {
              shell.openExternal(
                'https://github.com/trufflesuite/ganache/blob/master/README.md'
              )
            }
          },
          {
            label: 'Community Discussions',
            click () {
              shell.openExternal(
                'https://github.com/trufflesuite/ganache/issues'
              )
            }
          },
          {
            label: 'Search Issues',
            click () {
              shell.openExternal(
                'https://github.com/trufflesuite/ganache/issues'
              )
            }
          }
        ]
      }
    ]
    menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }
})
