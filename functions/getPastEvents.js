export default async function getPastEventsTree(
  startingIndex,
  EndingIndex,
  contract,
  eventName,
  filter
) {
  console.log(startingIndex, EndingIndex);
  return new Promise(async (resolve, reject) =>
    contract
      .getPastEvents(
        eventName,
        {
          filter,
          fromBlock: startingIndex,
          toBlock: EndingIndex,
        },
        function (error, events) {
          if (error) {
            if (
              error.message ===
              "Returned error: query returned more than 10000 results"
            ) {
              const p1Index = Math.floor(
                startingIndex + (EndingIndex - startingIndex) / 2
              );
              const p2Index = p1Index + 1;

              getPastEventsTree(
                startingIndex,
                p1Index,
                contract,
                eventName,
                filter
              )
                .then(async (promise1result) => {
                  const promise2result = await getPastEventsTree(
                    p2Index,
                    EndingIndex,
                    contract,
                    eventName,
                    filter
                  );
                  return [...promise1result, ...promise2result];
                })
                .then(resolve)
                .catch((err) => console.log("err", err));
            } else {
              resolve(async () =>
                getPastEventsTree(
                  startingIndex,
                  EndingIndex,
                  contract,
                  eventName,
                  filter
                )
              );
            }
            // reject(error);
          } else {
            if (events && events.length) {
              resolve(events);
            } else {
              resolve([]);
            }
          }
        }
      )
      .catch((err) => console.log(err.message))
  );
}
