const setTime = async (provider: any, timestamp: number) => {
    await provider.send("evm_mine", [timestamp]);
    // await provider.send("evm_setNextBlockTimestamp", [timestamp]);
}

const currentTime = () => {
    let now = new Date();
    return Math.floor(now.getTime() / 1000);
}

export {
    setTime,
    currentTime
}