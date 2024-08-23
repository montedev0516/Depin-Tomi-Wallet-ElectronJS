import path from 'path'
import { app, ipcMain } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import os from 'os'
import sys from 'systeminformation'
import {SuperfaceClient} from '@superfaceai/one-sdk'
import PublicIP from 'public-ip'


const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

;(async () => {
  await app.whenReady()

  const mainWindow = createWindow('main', {
    width:1000, 
    height:900,
    resizable:false,
    center:true,
    maximizable:false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration:true,
      contextIsolation:true
    },
    icon:"./resources/favicon.ico",
    autoHideMenuBar:true,
    frame:false,
    transparent:true,
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}`)
    mainWindow.webContents.openDevTools()
  }
// ----------------------------------------------Minimize IPC--------------------------------------------
  ipcMain.on('minimize',(event,arg) => {
    arg === true && mainWindow.minimize()
  })
  
  // --------------------------------------------Com Data IPC----------------------------------------------
  ipcMain.on('getData', async (event, arg) => {
    let hd;
  await sys.diskLayout().then(async(data) => {
    hd = String(Math.ceil(data[0].size / 1024 / 1024 / 1024 /1024) + "TB")
  })
  event.sender.send("getData", {
      cpu: `${os.cpus()[0].model} ${os.cpus().length} Cores`,
      ram: `${Math.ceil(os.totalmem() / 1024 / 1024 / 1024)}GB`,
      hd: hd
    })
    
  });

  // ------------------------------------------Net Information IPC-----------------------------------------
  let interval:any;
  ipcMain.on('getNetInfo', async (event, arg) => {
    if(arg === true){
      const downloadSpeeds:number[] = [], uploadSpeeds:number[] = [];
      let times = 1;
      while(times++ <= 10){
        await sys.networkStats().then((data: any) => {
          const downloadSpeed = (data[0].rx_sec / 1024);
          const uploadSpeed = (data[0].tx_sec / 1024);
          downloadSpeeds.push(downloadSpeed);
          uploadSpeeds.push(uploadSpeed);
        })
      }
      const calculateAverage = (array:number[]): number =>  {
        if (array.length === 0) {
            return 0; 
        }
        const total = array.reduce((accumulator, currentValue) => accumulator + currentValue, 0)
        const average = total / array.length; 
        return average;
      }
      
      event.sender.send("getNetInfo", {
        downloadSpeed:`${calculateAverage(downloadSpeeds).toFixed(2)} KB/s`,
        uploadSpeed:`${calculateAverage(uploadSpeeds).toFixed(2)} KB/s`
      })
  }
  else clearInterval(interval);
  })
})()

// ----------------------------------------------Location IPC---------------------------------------------------

ipcMain.on('getLocation', async(event, arg) => {
  const sdk = new SuperfaceClient();
  const profile =  await sdk.getProfile("address/ip-geolocation@1.0.1");
  const networkInterface:any = await sys.networkInterfaces()
  const ipAddress = networkInterface[0].ip4;
  const result:any = await profile.getUseCase("IpGeolocation").perform(
      {
        ipAddress: "45.250.255.140"
      },
      {
        provider: "ipdata",
        security: {
          apikey: {
            apikey: "9a511b6fc8334e1852cfbbd4ff3f1af3c42ed6abc75e96a1648b969a"
          }
        }
      }
    ).then((data) => data.unwrap());
    event.sender.send("getLocation", result.addressCountry)
});


app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})
