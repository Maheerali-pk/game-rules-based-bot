import deepcopy = require("deepcopy")
import { getCellByMapIdAndOrder } from "../gameHelpers"

export const getMoneyChangeToAddHosueOnProperty = (
  game: IGame,
  propertyOrder: number
) => {
  const property = getCellByMapIdAndOrder(game.settings.mapId, propertyOrder)
  if (property.type !== "property") return 0
  const currentHouseData = game.situation.housesData.find(
    (item) => item.propertyOrder === propertyOrder
  )
  if (!currentHouseData) return 0
  const moneyNeededForNextHouse =
    property.propertyDetails.rentData.upgradeItems.find(
      (item) => item.count === currentHouseData.houses + 1
    )?.price
  return moneyNeededForNextHouse
}
export const getMoneyGainedByHouseRemovingOnProperty = (
  game: IGame,
  propertyOrder: number,
  count: number
) => {
  const property = getCellByMapIdAndOrder(game.settings.mapId, propertyOrder)
  if (property.type !== "property") return 0
  const currentHouseData = game.situation.housesData.find(
    (item) => item.propertyOrder === propertyOrder
  )
  if (!currentHouseData) return 0
  const houseRemovalAmounts = Array(count)
    .fill(0)
    .map(
      (_, index) =>
        property.propertyDetails.rentData.upgradeItems.find(
          (item) => item.count === currentHouseData.houses - index
        )?.price / 2
    )
  const moneyGainedByRemovingHouse = houseRemovalAmounts.reduce(
    (acc, item) => acc + item,
    0
  )
  return moneyGainedByRemovingHouse
}
export const getHousesChangesToGetOutBankruptcy = (
  game: IGame,
  bot: IPlayer
) => {
  debugger

  const moneyNeeded = Math.abs(bot.money)
  const myHouses = game.situation.housesData.filter(
    (item) => bot.properties.includes(item.propertyOrder) && item.houses > 0
  )
  const res: IPropManagementChange = {
    houseChanges: [],
    mortgagedProps: [],
    unMortgagedProps: [],
  }
  let totalMoneyGained = 0
  let anyHousesLeft = false
  let completeHouseData = deepcopy(game.situation.housesData)
  do {
    for (let i = 0; i < myHouses.length; i++) {
      const tempHouseChangeItem = res.houseChanges.find(
        (item) => item.propertyOrder === myHouses[i].propertyOrder
      )
      const moneyGainedByRemovingHouse =
        getMoneyGainedByHouseRemovingOnProperty(
          game,
          myHouses[i].propertyOrder,
          Math.abs(tempHouseChangeItem?.houses) || 1
        )
      if (moneyGainedByRemovingHouse > 0) {
        if (tempHouseChangeItem?.houses) {
          tempHouseChangeItem.houses -= 1
        } else {
          res.houseChanges.push({
            propertyOrder: myHouses[i].propertyOrder,
            houses: (tempHouseChangeItem?.houses || 0) - 1,
          })
        }
        completeHouseData.find(
          (item) => item.propertyOrder === myHouses[i].propertyOrder
        ).houses -= 1
      }
    }
    totalMoneyGained = res.houseChanges.reduce(
      (acc, item) =>
        acc +
        getMoneyGainedByHouseRemovingOnProperty(
          game,
          item.propertyOrder,
          Math.abs(item?.houses || 0)
        ),
      0
    )
    // completeHouseData = deepcopy(game.situation.housesData)
    anyHousesLeft = completeHouseData.some(
      (item) =>
        item?.houses > 0 && bot?.properties?.includes(item?.propertyOrder)
    )
  } while (totalMoneyGained < moneyNeeded && anyHousesLeft)

  return {
    changes: res,
    moneyChange: totalMoneyGained,
    finalHouseData: completeHouseData,
  }
}
