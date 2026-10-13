// Older in-progress games did not store a captain with each proposal.
export function withProposalLeaders(proposals, players, currentLeader, phase) {
  const currentIndex = players.findIndex(player => player.id === currentLeader);
  if (currentIndex < 0) return proposals;
  const lastKeepsLeader = proposals.at(-1)?.approved && !["propose", "vote"].includes(phase);
  return proposals.map((proposal, index) => {
    if (proposal.leader !== undefined && proposal.leader !== null) return proposal;
    const rotations = proposals.length - index - (lastKeepsLeader ? 1 : 0);
    const leaderIndex = ((currentIndex - rotations) % players.length + players.length) % players.length;
    return { ...proposal, leader: players[leaderIndex].id };
  });
}
