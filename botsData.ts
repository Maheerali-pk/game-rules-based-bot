import { Socket } from "socket.io";
import { io, Socket as ClientSocket } from "socket.io-client"
import { DefaultEventsMap } from "socket.io/dist/typed-events"
import { initBotEvents } from "./main"
import { emailToSocketMap } from "../globals"

type BotSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>

// const test : BotSocket = io("")
// test.emit("game.di")
export const botSockets: { [k in string]: BotSocket } = {}
interface IBotData {
  gameId: string
  email: string
  noMoreRoles: boolean
  playedAllPossibleCards: boolean
  tradeOfferHistory: ITrade[]
  housesBuilt: boolean
  housesRemoved: boolean
  username: string
}

export const allBotsUserData: Partial<IUser>[] = [
  {
    username: "Bot 1",
    profileImage:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTOZJstuwHfKv75nxlJAbApKncTyc09nWKQHw&s",
  },
  {
    username: "Bot 2",
    profileImage:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTOZJstuwHfKv75nxlJAbApKncTyc09nWKQHw&s",
  },
  {
    username: "Bot 3",
    profileImage:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTOZJstuwHfKv75nxlJAbApKncTyc09nWKQHw&s",
  },
  {
    username: "Bot 4",
    profileImage:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTOZJstuwHfKv75nxlJAbApKncTyc09nWKQHw&s",
  },
]

export const botsData: { [k in string]: IBotData } = {}

export const getBotDataById = (botId: string) => {
  return botsData[botId]
}
export const setBotData = (botId: string, data: Partial<IBotData>) => {
  botsData[botId] = {
    ...botsData[botId],
    ...data,
  }
}
export const removeBotData = (botId: string) => {
  delete botsData[botId]
}

export const addBotSocket = async (
  email: string,
  username: string,
  gameId?: string
) => {
  const socket: ClientSocket<ServerToClientEvents, ClientToServerEvents> = io(
    "http://localhost:5000"
  )
  botSockets[email] = socket
  botsData[email] = {
    noMoreRoles: false,
    username,
    email,
    gameId,
    playedAllPossibleCards: false,
    tradeOfferHistory: [],
    housesBuilt: false,
    housesRemoved: false,
  }

  // For bots, we'll bypass authentication and directly join the room
  // socket.emit("verifyToken", email, (res) => {
  //   if (!res) {
  //     console.log("Bot token verification failed")
  //     socket.disconnect()
  //     return
  //   }

  //
  // })
  // socket.emit("joinRoom", { roomid: gameId }, (success) => {
  //   if (success) {
  //     console.log(`Bot ${email} joined game room ${gameId}`)
  //     initBotEvents(email)
  //   } else {
  //     console.error(`Bot ${email} failed to join game room ${gameId}`)
  //   }
  // })
  return new Promise((resolve, reject) => {
    socket.on("connect", () => {
      if (!gameId) {
        socket.emit("verifyBotToken", email, username, (res) => {
          if (!res) {
            reject(false)
          } else {
            resolve(true)
          }
        })
      } else {
        setTimeout(() => {
          socket.emit("joinRoom", { roomid: gameId }, (success) => {
            if (success) {
              console.log(`Bot ${email} joined game room ${gameId}`)
              initBotEvents(email)
              resolve(true)
            } else {
              console.error(`Bot ${email} failed to join game room ${gameId}`)
              reject(false)
            }
          })
        }, 100)
      }
    })
  })
}

export const getBotSocket = (email: string) => {
  return botSockets[email]
}

export const removeBotSocket = (email: string) => {
  const socket = botSockets[email]
  emailToSocketMap.delete(email)
  socket?.disconnect()

  delete botSockets[email]
  removeBotData(email)
}
