import {
  calculateRent,
  getCellByMapIdAndOrder,
  getMapById,
} from "../gameHelpers"
import { getMoneyNeededForAuctionsForNextRound } from "./auction"
import { getExpectedRentInNextTurn } from "./botHelpers"
import { botConstants } from "./data"

export const getOtherPlayersWithMoneyAboveThreshold = (
  game: IGame,
  bot: IPlayer,
  threshold: number
) => {
  const otherPlayers = game?.situation?.players.filter(
    (player) => player.id !== bot.id
  )
  return otherPlayers.filter((player) => player.money > threshold)
}
export const getAvgMoneyOfOtherPlayers = (game: IGame, bot: IPlayer) => {
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== bot.id
  )
  return (
    otherPlayers.reduce((acc, player) => acc + player.money, 0) /
    otherPlayers.length
  )
}

export const getPlayerCompletedSets = (game: IGame, player: IPlayer) => {
  const playerProperties = player.properties.map((property) =>
    getCellByMapIdAndOrder(game.settings.mapId, property)
  )
  const map = getMapById(game.settings.mapId)
  const completedSets = map.groups.filter((group) => {
    const groupProperties = playerProperties.filter(
      (property) => property.propertyDetails.groupId === group.id
    )
    return groupProperties.length === group.propertiesCount
  })
  return completedSets
}
const calculatePlayerWorth = (game: IGame, player: IPlayer) => {
  const money = player.money
  const stockMoney = player.stock * player.stockMultiplier
  const playerProperties = player.properties.map((property) =>
    getCellByMapIdAndOrder(game.settings.mapId, property)
  )
  const propertyMoney = player.properties.reduce(
    (acc, property) =>
      acc +
      getCellByMapIdAndOrder(game.settings.mapId, property).propertyDetails
        .price,
    0
  )
  const completedSets = getPlayerCompletedSets(game, player)
  const completedSetsWorth = completedSets.length * 400

  return completedSetsWorth + propertyMoney + stockMoney + money
}

export const getPlayerWithMaxWorth = (game: IGame, players: IPlayer[]) => {
  const playersWithWorth = players.map((player) => ({
    player,
    worth: calculatePlayerWorth(game, player),
  }))
  return playersWithWorth.sort((a, b) => b.worth - a.worth)[0].player
}

export const getPlayerWithMaxMoney = (game: IGame, players: IPlayer[]) => {
  const playersWithWorth = players.map((player) => ({
    player,
    money: player.money,
  }))
  return playersWithWorth.sort((a, b) => b.money - a.money)[0].player
}
export const getRentDataForNextRound = (
  game: IGame,
  bot: IPlayer
): { avg: number; max: number } => {
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== bot.id
  )
  const allRents = otherPlayers.map((player) => {
    const playerProperties = player.properties.map((property) =>
      getCellByMapIdAndOrder(game.settings.mapId, property)
    )
    const rent = playerProperties.reduce(
      (acc, property) =>
        acc +
        calculateRent(game.id, property.propertyDetails.price, player.order),
      0
    )
    return rent
  })
  const totalRent =
    allRents.reduce((acc, rent) => acc + rent, 0) / allRents.length
  return { avg: totalRent, max: Math.max(...allRents) }
}

export const getExpectedMoneyLossByCardsInNextRound = (
  game: IGame,
  bot: IPlayer
): number => {
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== bot.id
  )
  const propertyTaxCards = otherPlayers.flatMap((player) =>
    player.cards.filter((card) => card.cardId === "apply-property-tax")
  )
  const get100FromOtherPlayerCards = otherPlayers.flatMap((player) =>
    player.cards.filter((card) => card.cardId === "get-200-from-player")
  )
  const moneyLossByPropertyTax =
    (propertyTaxCards.reduce(
      (acc, card) => acc + bot.properties.length * 25,
      0
    ) /
      otherPlayers.length) *
    botConstants.safePlayFactor

  const moneyLossByGet100FromOtherPlayer =
    (get100FromOtherPlayerCards.reduce((acc, card) => acc + 100, 0) /
      otherPlayers.length) *
    botConstants.safePlayFactor
  return moneyLossByPropertyTax + moneyLossByGet100FromOtherPlayer
}

export const getMoneyNeedInNextRound = (game: IGame, bot: IPlayer) => {
  const expectedRent = getExpectedRentInNextTurn(game.id, bot.id)
  const moneyNeededForAuctions = getMoneyNeededForAuctionsForNextRound(
    game,
    bot
  )
  const moneyLossByCards = getExpectedMoneyLossByCardsInNextRound(game, bot)
  const needForMoney = expectedRent + moneyNeededForAuctions + moneyLossByCards
  return needForMoney
}
export const getMoneyNeedInNextRoundToCheckForHouses = (
  game: IGame,
  bot: IPlayer
) => {
  const expectedRent = getExpectedRentInNextTurn(game.id, bot.id)
  const moneyNeededForAuctions =
    getMoneyNeededForAuctionsForNextRound(game, bot) * 0.4
  const moneyLossByCards = getExpectedMoneyLossByCardsInNextRound(game, bot)
  const needForMoney = expectedRent + moneyNeededForAuctions + moneyLossByCards
  return needForMoney
}
export const getMaxRentInNextTurn = (game: IGame, bot: IPlayer) => {
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== bot.id
  )
  const allRents = otherPlayers.flatMap((player) => {
    return player.properties.map((propOrder) =>
      calculateRent(game.id, propOrder, bot.order)
    )
  })
  // const totalRent =
  return Math.max(...allRents)
  // return totalRent
}
