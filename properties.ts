import { isPropertyAccessChain } from "typescript"
import { getCellByMapIdAndOrder, getMapById } from "../gameHelpers"
import { getInGamePlayers } from "./botHelpers"
import {
  getMoneyNeedInNextRound,
  getMoneyNeedInNextRoundToCheckForHouses,
} from "./money"
import { getMoneyChangeToAddHosueOnProperty } from "./houses"
import { maxHousesPerProperty } from "../constants"
import _ = require("lodash")
import deepcopy = require("deepcopy")

export const getGeneralImportanceOfPropertyForPlayer = (
  game: IGame,
  bot: IPlayer,
  propertyOrder: number
) => {
  const cell = getCellByMapIdAndOrder(game.settings.mapId, propertyOrder)
  if (cell.type !== "property") return 0
  if (!bot) return 0
  const baseRent =
    cell.propertyDetails.groupId === "8"
      ? 30
      : cell.propertyDetails.rentData.base
  return (baseRent / 80) * (bot.role === "rent-lord" ? 1.5 : 1)
}
export const getOwnerOfProperty = (game: IGame, propertyOrder: number) => {
  return game.situation.players.find((player) =>
    player.properties.includes(propertyOrder)
  )
}
export const getColorStatusOfPropertyForPlayer = (
  game: IGame,
  bot: IPlayer,
  propertyOrder: number
) => {
  debugger
  const cell = getCellByMapIdAndOrder(game.settings.mapId, propertyOrder)
  // if (cell.type !== "property") return 0
  const map = getMapById(game.settings.mapId)
  const groupId = cell.propertyDetails.groupId
  const group = map.groups.find((group) => group.id === groupId)
  const botProperties = bot.properties.map((property) =>
    getCellByMapIdAndOrder(game.settings.mapId, property)
  )
  if (!map || !group || !cell) return
  const otherPropertiesOfThisGroupPlayerHas = botProperties.filter(
    (property) => property.propertyDetails.groupId === groupId
  )
  const allSoldProperties = game.situation.players.flatMap(
    (player) => player.properties
  )
  const unsoldPropertiesFromThisGroup = map.cells.filter(
    (cell) =>
      cell?.propertyDetails?.groupId === groupId &&
      !bot.properties.includes(cell.order)
  )
  const soldPropertiesFromThisGroup = map.cells.filter(
    (cell) =>
      cell?.propertyDetails?.groupId === groupId &&
      allSoldProperties.includes(cell.order)
  )
  const ownersOfThisGroup = Array.from(
    new Set(
      soldPropertiesFromThisGroup.map(
        (property) => getOwnerOfProperty(game, property.order).order
      )
    )
  )
  const propertyCountPlayerDoesntHave =
    group.propertiesCount - otherPropertiesOfThisGroupPlayerHas.length

  return {
    total: group.propertiesCount,
    sold: soldPropertiesFromThisGroup.length,
    ownedByPlayer: otherPropertiesOfThisGroupPlayerHas.length,
    ownersCount: ownersOfThisGroup.length,
    owners: ownersOfThisGroup,
    groupId: groupId,
    propertyOrder: propertyOrder,
  }
}
export const getColorImportanceOfPropertyForPlayer = (
  game: IGame,
  bot: IPlayer,
  propertyOrder: number
) => {
  // debugger
  const cell = getCellByMapIdAndOrder(game.settings.mapId, propertyOrder)
  if (cell.type !== "property") return 0
  const map = getMapById(game.settings.mapId)
  const groupId = cell.propertyDetails.groupId
  const group = map.groups.find((group) => group.id === groupId)
  const botProperties = bot?.properties.map((property) =>
    getCellByMapIdAndOrder(game.settings.mapId, property)
  )
  if (!map || !group || !cell || !botProperties) return 0
  const otherPropertiesOfThisGroupPlayerHas = botProperties?.filter(
    (property) => property?.propertyDetails?.groupId === groupId
  )
  const unsoldPropertiesFromThisGroup = map.cells.filter(
    (cell) =>
      cell?.propertyDetails?.groupId === groupId &&
      !bot.properties.includes(cell.order)
  )

  const soldPropertiesFromThisGroup = map.cells.filter(
    (cell) =>
      cell?.propertyDetails?.groupId === groupId &&
      bot.properties.includes(cell.order)
  )
  const ownersOfThisGroup = Array.from(
    new Set(
      soldPropertiesFromThisGroup.map(
        (property) => getOwnerOfProperty(game, property.order).order
      )
    )
  )
  const propertyCountPlayerDoesntHave =
    group.propertiesCount - otherPropertiesOfThisGroupPlayerHas.length

  //No property of this group sold yet.
  if (group.propertiesCount === 2) {
    if (unsoldPropertiesFromThisGroup.length === 2) return 1
    if (
      unsoldPropertiesFromThisGroup.length === 1 &&
      otherPropertiesOfThisGroupPlayerHas.length === 1
    )
      return 2
    if (
      unsoldPropertiesFromThisGroup.length === 1 &&
      otherPropertiesOfThisGroupPlayerHas.length === 0
    )
      return 1.5
  }
  if (group.propertiesCount === 3) {
    if (unsoldPropertiesFromThisGroup.length === 3) return 1
    if (
      unsoldPropertiesFromThisGroup.length === 2 &&
      otherPropertiesOfThisGroupPlayerHas.length === 0
    )
      return 1.1
    if (
      unsoldPropertiesFromThisGroup.length === 2 &&
      otherPropertiesOfThisGroupPlayerHas.length === 1
    )
      return 1.5
    if (
      unsoldPropertiesFromThisGroup.length === 1 &&
      otherPropertiesOfThisGroupPlayerHas.length === 2
    ) {
      return 2.25
    }

    if (
      unsoldPropertiesFromThisGroup.length === 1 &&
      otherPropertiesOfThisGroupPlayerHas.length === 1
    )
      return 1.5
    if (
      unsoldPropertiesFromThisGroup.length === 1 &&
      otherPropertiesOfThisGroupPlayerHas.length === 0
    ) {
      if (ownersOfThisGroup.length === 1) return 2
      else return 1.35
    }
  }
  if (group.propertiesCount === 4) {
    if (otherPropertiesOfThisGroupPlayerHas.length === 0) return 1
    if (otherPropertiesOfThisGroupPlayerHas.length === 1) return 1.1
    if (otherPropertiesOfThisGroupPlayerHas.length === 2) return 1.5
    if (otherPropertiesOfThisGroupPlayerHas.length === 1) return 2
  }
  return 0
}
export const getMostImportantPropertyForPlayer = (
  game: IGame,
  bot: IPlayer
) => {
  const map = getMapById(game.settings.mapId)
  const allSoldProperties = game.situation.players.flatMap(
    (player) => player.properties
  )
  const allUnsoldProperties = map.cells.filter(
    (cell) =>
      cell.type === "property" && !allSoldProperties.includes(cell?.order)
  )
  const importanceOfProperties = allUnsoldProperties.map((property) =>
    getColorImportanceOfPropertyForPlayer(game, bot, property.order)
  )
  const maxImportance = Math.max(...importanceOfProperties)
  return {
    property: allUnsoldProperties.find(
      (property) => importanceOfProperties[property.order] === maxImportance
    ),
    importance: maxImportance,
  }
}
export const getPlayerWithMaxProperties = (game: IGame, players: IPlayer[]) => {
  return [...players].sort(
    (a, b) => b.properties.length - a.properties.length
  )[0]
}
export const getNeedForBuyingMoreProperties = (game: IGame, bot: IPlayer) => {
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== bot.id
  )
  const inGamePlayers = getInGamePlayers(game)
  const allPropeties = game.situation.players.flatMap(
    (player) => player.properties
  )
  const map = getMapById(game.settings.mapId)
  const soldProperties = map.cells.filter((item) =>
    allPropeties.includes(item.order)
  )
  const totalProperties = map.cells.filter((item) => item.type === "property")
  const unsoldProperties = totalProperties.length - soldProperties.length
  const propertiesPlayerShouldHave =
    soldProperties.length / inGamePlayers.length
  const propertiesSoldFactor = unsoldProperties / totalProperties.length

  const avgPropertiesPlayersWillGetMore =
    unsoldProperties / inGamePlayers.length
  const result =
    (propertiesPlayerShouldHave + avgPropertiesPlayersWillGetMore + 15) /
    (avgPropertiesPlayersWillGetMore + bot.properties.length + 15)
  console.log(result, bot.order, "result from get need for buying properties")
  const progress = soldProperties.length / totalProperties.length // value from 0 to ~1
  const decay = 1 - Math.max(0, progress - 0.35) // starts reducing after ~35% properties are sold
  const adjustedResult = result * Math.max(decay, 0.5) // decay won't go below 0.5
  return isNaN(adjustedResult) ? 1 : adjustedResult
}

export const getPropertiesOfPlayerWhichCompleteHisSet = (
  game: IGame,
  bot: IPlayer
) => {
  const map = getMapById(game.settings.mapId)
  const groupIds = map.groups.map((group) => group.id)
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== bot.id
  )
  const allOtherSoldProperties = otherPlayers.flatMap(
    (player) => player.properties
  )
  const statusOfPropertiesOfOtherPlayers = allOtherSoldProperties.map(
    (property) => getColorStatusOfPropertyForPlayer(game, bot, property)
  )
  const propertiesWhichBotNeedFromOthers =
    statusOfPropertiesOfOtherPlayers.filter((status) => {
      if (status.total === 2 && status.sold === 2 && status.ownedByPlayer === 1)
        return true
      if (status.total === 3 && status.sold === 3 && status.ownedByPlayer === 2)
        return true
      if (status.total === 4 && status.sold === 4 && status.ownedByPlayer === 3)
        return true
      return false
    })

  return propertiesWhichBotNeedFromOthers.map((item) => ({
    propertyOrder: item.propertyOrder,
    ownerOrder: getOwnerOfProperty(game, item.propertyOrder)?.order,
  }))
}

export const getPropertiesOtherPlayersNeedFromYou = (
  game: IGame,
  bot: IPlayer
) => {
  const map = getMapById(game.settings.mapId)
  const groupIds = map.groups.map((group) => group.id)
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== bot.id
  )
  const playersWhoNeedPropertiesFromYou = otherPlayers
    .map((player) => {
      const propertiesNeedByOtherPlayer =
        getPropertiesOfPlayerWhichCompleteHisSet(game, player)
      const propertiesWhichBotCanGiveToOtherPlayer =
        propertiesNeedByOtherPlayer.filter((item) =>
          bot.properties.includes(item.propertyOrder)
        )
      return {
        playerOrder: player.order,
        properties: propertiesWhichBotCanGiveToOtherPlayer,
      }
    })
    .flatMap((player) =>
      player.properties.map((prop) => ({
        neederOrder: player.playerOrder,
        propertyOrder: prop.propertyOrder,
      }))
    )
  return playersWhoNeedPropertiesFromYou
}
export const getNoOfCompletedSets = (game: IGame, bot: IPlayer) => {
  const propertiesInCompletedSets = getPropertiesInCompletedSetsOfPlayer(
    game,
    bot
  )
  return Array.from(
    new Set(propertiesInCompletedSets.map((item) => item.groupId))
  ).length
}
export const getPropertiesInCompletedSetsOfPlayer = (
  game: IGame,
  bot: IPlayer
) => {
  const map = getMapById(game.settings.mapId)
  const myPropertiesStatus = bot.properties.map((property) =>
    getColorStatusOfPropertyForPlayer(game, bot, property)
  )
  const propertiesInCompletedSets = myPropertiesStatus.filter((status) => {
    if (status.total === 2 && status.sold === 2 && status.ownedByPlayer === 2)
      return true
    if (status.total === 3 && status.sold === 3 && status.ownedByPlayer === 3)
      return true
    if (status.total === 4 && status.sold === 4 && status.ownedByPlayer === 4)
      return true
    return false
  })
  return propertiesInCompletedSets
}

export const getHouseBuildingData = (
  game: IGame,
  bot: IPlayer
):
  | {
    changes: IPropManagementChange
    moneyChange: number
    finalHouseData: PlayerPropertyHouseData[]
  }
  | undefined => {
  const map = getMapById(game.settings.mapId)
  const propertiesInCompletedSets = getPropertiesInCompletedSetsOfPlayer(
    game,
    bot
  )
  // console.log("get house building data")
  debugger
  const moneyAvailableForHouses =
    bot.money - getMoneyNeedInNextRoundToCheckForHouses(game, bot) * 0.8
  console.log(moneyAvailableForHouses, "money available for houses")
  const completedSets = Array.from(
    new Set(propertiesInCompletedSets.map((item) => item.groupId))
  )
  if (completedSets.length === 0) return
  const res: IPropManagementChange = {
    houseChanges: [],
    mortgagedProps: [],
    unMortgagedProps: [],
  }
  let totalCost = 0

  const completeHouseData = deepcopy(game.situation.housesData)
  let canBuild = true

  for (let i = 0; i < propertiesInCompletedSets.length; i++) {
    const property = propertiesInCompletedSets[i]
    const moneyNeededForNextHouse = getMoneyChangeToAddHosueOnProperty(
      game,
      property.propertyOrder
    )

    if (moneyNeededForNextHouse + totalCost > moneyAvailableForHouses) {
      canBuild = false
      break
    }

    let tempHouseChangeItem = res.houseChanges.find(
      (item) => item.propertyOrder === property.propertyOrder
    )
    const previousHouseItem = game.situation.housesData.find(
      (item) => item.propertyOrder === property.propertyOrder
    )
    if (!tempHouseChangeItem) {
      res.houseChanges.push({
        propertyOrder: property.propertyOrder,
        houses: 1,
      })
      tempHouseChangeItem = res.houseChanges.find(
        (item) => item.propertyOrder === property.propertyOrder
      )
    }
    if (
      tempHouseChangeItem?.houses + (previousHouseItem?.houses || 0) >
      maxHousesPerProperty
    )
      continue
    tempHouseChangeItem.houses++
    const completeHouseDataItem = completeHouseData?.find(
      (item) => item.propertyOrder === property.propertyOrder
    )
    if (completeHouseDataItem) completeHouseDataItem.houses++
    totalCost += moneyNeededForNextHouse
  }
  if (res.houseChanges.length === 0) return
  if (totalCost === 0) return
  return {
    changes: res,
    moneyChange: -totalCost,
    finalHouseData: completeHouseData,
  }
}

export const getPropertiesWhichCompleteSetOfOtherPlayer = (game: IGame, bot: IPlayer) => {
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== bot.id
  )
  const propertiesWhichCompleteSetOfOtherPlayer = otherPlayers.flatMap(
    (player) => getPropertiesOfPlayerWhichCompleteHisSet(game, player)
  )
  return propertiesWhichCompleteSetOfOtherPlayer
}


export const getPropertiesWithHouses = (game: IGame, bot: IPlayer) => {
  const myProperties = bot.properties.filter(
    (property) =>
      game.situation.housesData.find((item) => item.propertyOrder === property)
        ?.houses > 0
  )
  return myProperties
}
