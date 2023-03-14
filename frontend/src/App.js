import React, { Component } from "react";
import { ethers } from "ethers";
import abi from "./abi";
import bytecode from "./bytecode";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      provider: null,
      accounts: [],
      stake: null,
      player_2_address: null,
      room_type: null,
      contract_address: "",
      salt: "",
      move: 1,
      signer: "",
      instance: null,
      solve: false,
      timeout: null,
      timeout_period: null,
      retry: false,
      moves: [null, "Rock", "Paper", "Scissors", "Spock", "Lizard"],
    };
    this.on_text_change = this.on_text_change.bind(this);
    this.join_game = this.join_game.bind(this);
    this.start_game = this.start_game.bind(this);
    this.solve_function = this.solve_function.bind(this);
  }

  componentDidMount() {
    this.getProvider();
  }

  async getProvider() {
    const { ethereum } = window;
    if (ethereum) {
      const provider = new ethers.providers.Web3Provider(ethereum);
      this.setState({ signer: provider.getSigner() });
      try {
        const accounts = await provider.listAccounts();
        this.setState({ accounts });
        // const ganache_provider = new ethers.providers.WebSocketProvider(
        //   "ws://localhost:7545"
        // );
        const goerli_provider = new ethers.providers.WebSocketProvider(
          "wss://goerli.infura.io/ws/v3/0e8423b2ced34e7fbb0fe8c4da56e63a"
        );
        this.setState({ provider: goerli_provider });
      } catch (error) {
        console.log(error);
      }
    }
  }

  async connectMetamask() {
    try {
      const { ethereum } = window;
      await ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.providers.Web3Provider(ethereum);
      this.setState({ signer: provider.getSigner() });
      const accounts = await provider.listAccounts();
      this.setState({ accounts });
      // const ganache_provider = new ethers.providers.WebSocketProvider(
      //   "ws://localhost:7545"
      // );
      const goerli_provider = new ethers.providers.WebSocketProvider(
        "wss://goerli.infura.io/ws/v3/0e8423b2ced34e7fbb0fe8c4da56e63a"
      );
      this.setState({ provider: goerli_provider });
    } catch (error) {
      console.log(error);
    }
  }

  async on_text_change(e) {
    const text = await e.target.value;
    this.setState({ [e.target.name]: text });
  }

  game_modal(val) {
    this.setState({ room_type: val });
  }

  async solve_function() {
    if (this.state.instance === null) {
      alert("Game has been completed");
    } else {
      try {
        await this.state.instance.solve(this.state.move, this.state.salt);
      } catch {
        alert("Some Error Occured Retry");
      }
    }
  }

  async join_game() {
    const rpsContract = new ethers.Contract(
      this.state.contract_address,
      abi,
      this.state.provider
    );
    this.setState({ instance: rpsContract });
    rpsContract.on("LogSolve", (winner, amount, move1, move2) => {
      clearTimeout(this.state.timeout);
      this.setState({ instance: null, retry: true });
      const returnedAddress = ethers.utils.getAddress(winner);
      if (returnedAddress === ethers.constants.AddressZero) {
        alert(
          `Player 1 move : ${
            this.state.moves[parseInt(move2)]
          } \n Player 2 move : ${this.state.moves[parseInt(move1)]} \n Tie`
        );
      } else {
        alert(
          `Player 1 move : ${
            this.state.moves[parseInt(move2)]
          } \n Player 2 move : ${
            this.state.moves[parseInt(move1)]
          } \n ${winner} Won`
        );
      }
    });
    const t = await rpsContract.TIMEOUT();
    this.setState({ timeout_period: t });

    const stake = await rpsContract.stake();

    try {
      const playTx = await rpsContract
        .connect(this.state.signer)
        .play(this.state.move, { value: stake });
      await playTx.wait();
    } catch {
      alert("Some Error Occured, Retry");
      this.setState({ instance: null });
    }

    const j1_timeout = setTimeout(async () => {
      alert(
        "Stake getting back to your account with reward to double \n Player 1 did not Solved"
      );
      await this.j1timeout();
      console.log("Done!");
    }, this.state.timeout_period * 1000);
    this.setState({ timeout: j1_timeout });
  }

  reload_function() {
    window.location.reload();
  }

  async j1timeout() {
    const tx = await this.state.instance.connect(this.state.signer).j1Timeout();
    await tx.wait(); // wait for transaction to be mined
    console.log("J1Timeout transaction confirmed!");
  }

  async start_game() {
    if (this.state.stake !== null && this.state.player_2_address !== null) {
      const contractFactory = new ethers.ContractFactory(
        abi,
        bytecode,
        this.state.signer
      );
      const salt = ethers.utils.formatBytes32String("secret");
      this.setState({ salt: salt });
      const stake = ethers.utils.parseEther(this.state.stake);
      const newContractInstance = await contractFactory
        .deploy(Number(this.state.move), salt, this.state.player_2_address, {
          value: stake,
        })
        .catch((error) => {
          alert("Some Error Occured, Retry");
        });
      await newContractInstance.deployed();
      this.setState({ instance: newContractInstance });
      // try {
      //   await newContractInstance.deployed();
      // } catch {
      //   alert("Some error Occured, Retry");
      // }
      newContractInstance.on("LogPlay", (address, move) => {
        if (this.state.room_type === "start") {
          this.setState({ solve: true });
          clearTimeout(this.state.timeout);
        }
      });
      newContractInstance.on("LogSolve", (winner, amount, move1, move2) => {
        this.setState({ instance: null, retry: true });
        const returnedAddress = ethers.utils.getAddress(winner);
        if (returnedAddress === ethers.constants.AddressZero) {
          alert(
            `Player 1 move : ${
              this.state.moves[parseInt(move2)]
            } \n Player 2 move : ${this.state.moves[parseInt(move1)]} \n Tie`
          );
        } else {
          alert(
            `Player 1 move : ${
              this.state.moves[parseInt(move2)]
            } \n Player 2 move : ${
              this.state.moves[parseInt(move1)]
            } \n ${winner} Won`
          );
        }
      });

      const t = await newContractInstance.TIMEOUT();
      const j2_timeout = setTimeout(async () => {
        try {
          alert(
            "Stake getting back to your account \n Player 2 did not Played"
          );
          await newContractInstance.j2Timeout();
        } catch {
          alert("something went wrong");
        }
      }, t * 1000); // The timeout is in seconds, so we multiply by 1000 to get milliseconds
      this.setState({ timeout: j2_timeout });
      const contractAddress = newContractInstance.address;
      this.setState({ contract_address: contractAddress });
    } else {
      alert("Some Input Value is missing");
    }
  }

  render() {
    const { accounts } = this.state;
    return (
      <div>
        {accounts.length > 0 ? (
          this.state.retry === false ? (
            <div>
              <p>Connected account: {accounts[0]}</p>
              {this.state.room_type === null ? (
                <div>
                  <button onClick={() => this.game_modal("start")}>
                    Create
                  </button>
                  <button onClick={() => this.game_modal("join")}>Join</button>
                </div>
              ) : null}
              {this.state.room_type === null ? null : this.state.room_type ===
                "start" ? (
                this.state.contract_address ? (
                  <div>
                    Share it with other player
                    <br />
                    {this.state.contract_address}
                    {this.state.solve === true ? (
                      <button onClick={this.solve_function}>Solve</button>
                    ) : null}
                  </div>
                ) : this.state.instance !== null ? null : (
                  <div>
                    <input
                      required
                      placeholder="Enter Player 2 Address"
                      onChange={this.on_text_change}
                      name="player_2_address"
                    />
                    <input
                      required
                      placeholder="Enter Stake"
                      onChange={this.on_text_change}
                      name="stake"
                    />
                    <label htmlFor="move">Select Move :</label>
                    <select
                      name="move"
                      value={this.state.move}
                      onChange={this.on_text_change}
                    >
                      <option value="1">Rock</option>
                      <option value="2">Paper</option>
                      <option value="3">Scissors</option>
                      <option value="4">Spock</option>
                      <option value="5">Lizard</option>
                    </select>
                    <button onClick={this.start_game}>Start</button>
                  </div>
                )
              ) : this.state.instance === null ? (
                <div>
                  Enter Contract address
                  <input
                    required
                    placeholder="Enter Contract Address"
                    onChange={this.on_text_change}
                    name="contract_address"
                  />
                  <label htmlFor="move">Select Move :</label>
                  <select
                    name="move"
                    value={this.state.move}
                    onChange={this.on_text_change}
                  >
                    <option value="1">Rock</option>
                    <option value="2">Paper</option>
                    <option value="3">Scissors</option>
                    <option value="4">Spock</option>
                    <option value="5">Lizard</option>
                  </select>
                  <button onClick={this.join_game}>Join</button>
                </div>
              ) : (
                "Waiting for player 1"
              )}
            </div>
          ) : (
            <div>
              <button onClick={this.reload_function}>Retry</button>
            </div>
          )
        ) : (
          <button
            onChange={this.on_text_change}
            onClick={() => this.connectMetamask()}
          >
            Connect Metamask
          </button>
        )}
      </div>
    );
  }
}

export default App;
